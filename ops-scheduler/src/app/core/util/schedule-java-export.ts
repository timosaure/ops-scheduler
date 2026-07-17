import { DateTime, Duration } from 'luxon';

import { Command } from '../models/command.model';
import { Module } from '../models/module.model';
import { ScheduleModuleWithModule } from '../models/schedule-module.model';
import { Schedule } from '../models/schedule.model';
import {
  absoluteTimeAtElapsedSeconds,
  commandOrderValue,
  orbitPositionAtElapsedSeconds,
  scheduleModuleElapsedSeconds,
} from './orbit-time';

const GROUP_ID = 0;
const REPEAT_CYCLE = 0;

const INVOKE_PATTERN =
  /^invoke\(new\s+([A-Za-z0-9_]+)\(\)((?:\.[A-Za-z0-9_]+\([^()]*\))*)\)\s*;?\s*$/;
const CLASS_NAME_PATTERN = /^([A-Za-z]{2}_[A-Za-z]{2}_\d{3})(\w*)$/;

const JAVA_KEYWORDS = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char', 'class', 'const',
  'continue', 'default', 'do', 'double', 'else', 'enum', 'extends', 'final', 'finally', 'float',
  'for', 'goto', 'if', 'implements', 'import', 'instanceof', 'int', 'interface', 'long', 'native',
  'new', 'package', 'private', 'protected', 'public', 'return', 'short', 'static', 'strictfp',
  'super', 'switch', 'synchronized', 'this', 'throw', 'throws', 'transient', 'try', 'void',
  'volatile', 'while',
]);

export interface JavaExportResult {
  source: string;
  warnings: string[];
}

interface ParsedInvocation {
  className: string;
  chain: string;
}

function parseInvocation(commandName: string): ParsedInvocation | null {
  const match = INVOKE_PATTERN.exec(commandName.trim());
  if (!match) {
    return null;
  }
  return { className: match[1], chain: match[2] };
}

function transformClassName(className: string, marker: 'T' | 'P'): string | null {
  const match = CLASS_NAME_PATTERN.exec(className);
  if (!match) {
    return null;
  }
  return `${match[1]}${marker}${match[2]}`;
}

function formatSignedNumber(value: number, paramName: string): string {
  return value >= 0 ? `${paramName} + ${value}` : `${paramName} - ${Math.abs(value)}`;
}

function escapeForComment(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Formats an absolute time as "yyyy-MM-ddTHH:mm:ss.SSS" (UTC, no offset), matching DateTimeUtil.absoluteTime's expected input. */
function formatAbsoluteTimeLiteral(date: Date): string {
  return DateTime.fromJSDate(date, { zone: 'utc' }).toFormat("yyyy-LL-dd'T'HH:mm:ss.SSS");
}

function toJavaMethodName(rawName: string, usedNames: Map<string, number>): string {
  const parts = rawName
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const [first, ...rest] = parts.length > 0 ? parts : ['module'];
  let name =
    first.toLowerCase() +
    rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join('');
  if (/^[0-9]/.test(name)) {
    name = `m${name}`;
  }
  if (JAVA_KEYWORDS.has(name)) {
    name = `${name}_`;
  }

  const count = usedNames.get(name);
  if (count == null) {
    usedNames.set(name, 1);
    return name;
  }
  const next = count + 1;
  usedNames.set(name, next);
  return `${name}${next}`;
}

function buildMtlLine(
  parsed: ParsedInvocation,
  subschedule: number,
  command: Command,
): string | null {
  const className = transformClassName(parsed.className, 'T');
  if (!className) {
    return null;
  }
  const ms = command.relative_time != null
    ? Math.round(Duration.fromISO(command.relative_time).as('milliseconds'))
    : 0;
  const timeExpr =
    ms === 0 ? 'baseTime' : `baseTime.add(DateTimeUtil.duration(${ms}, UnitsEapl.ms))`;
  return `invoke(new ${className}()${parsed.chain}.RefTime(DateTimeUtil.toString(${timeExpr})).Ssid(${subschedule}).Groupid(${GROUP_ID}));`;
}

function buildOpsLine(
  parsed: ParsedInvocation,
  subschedule: number,
  command: Command,
): string | null {
  const className = transformClassName(parsed.className, 'P');
  if (!className) {
    return null;
  }
  const angle = command.relative_orbit_angle ?? 0;
  const angleExpr = angle === 0 ? 'deltaAngle' : formatSignedNumber(angle, 'deltaAngle');
  return `invoke(new ${className}()${parsed.chain}.OrbitNumber(orbitNumber).OrbitAng(${angleExpr}).Ssid(${subschedule}).Groupid(${GROUP_ID}).RepeatCycle(${REPEAT_CYCLE}));`;
}

function buildMethodBody(
  module: Module,
  subschedule: number,
  commands: Command[],
  warnings: string[],
): string[] {
  const sorted = [...commands].sort(
    (a, b) => commandOrderValue(module.type, a) - commandOrderValue(module.type, b),
  );
  const lines: string[] = [];
  for (const command of sorted) {
    const parsed = parseInvocation(command.name);
    const line = parsed
      ? module.type === 'MTL'
        ? buildMtlLine(parsed, subschedule, command)
        : buildOpsLine(parsed, subschedule, command)
      : null;
    if (line) {
      lines.push(`    ${line}`);
    } else {
      warnings.push(`Module "${module.name}": could not parse command "${command.name}"`);
      lines.push(`    // TODO: could not parse command, insert manually: ${escapeForComment(command.name)}`);
    }
  }
  return lines;
}

function buildMethod(
  module: Module,
  subschedule: number,
  commands: Command[],
  methodName: string,
  warnings: string[],
): string {
  const signature: string =
    module.type === 'MTL'
      ? `public void ${methodName}(IAbsoluteTime baseTime) {`
      : `public void ${methodName}(int orbitNumber, double deltaAngle) {`;
  const body = buildMethodBody(module, subschedule, commands, warnings);
  return [signature, ...body, '}'].join('\n');
}

function buildBodyCall(
  schedule: Schedule,
  scheduleModule: ScheduleModuleWithModule,
  methodName: string,
): string {
  const elapsedSeconds = scheduleModuleElapsedSeconds(schedule, scheduleModule);
  if (scheduleModule.module.type === 'MTL') {
    const time = formatAbsoluteTimeLiteral(absoluteTimeAtElapsedSeconds(schedule, elapsedSeconds));
    return `${methodName}(DateTimeUtil.absoluteTime("${time}"));`;
  }
  const { orbitNumber, orbitAngle } = orbitPositionAtElapsedSeconds(schedule, elapsedSeconds);
  return `${methodName}(${orbitNumber}, ${round(orbitAngle, 3)});`;
}

function buildBodyMethod(
  schedule: Schedule,
  scheduleModules: ScheduleModuleWithModule[],
  methodNameByModuleId: Map<number, string>,
): string {
  // Every module_id here was used to populate methodNameByModuleId below, so the lookup always hits.
  const body = scheduleModules.map(
    (scheduleModule) => `    ${buildBodyCall(schedule, scheduleModule, methodNameByModuleId.get(scheduleModule.module_id)!)}`,
  );
  return ['public void body() {', ...body, '}'].join('\n');
}

export function buildScheduleJavaSource(
  schedule: Schedule,
  scheduleModules: ScheduleModuleWithModule[],
  commandsByModuleId: Map<number, Command[]>,
): JavaExportResult {
  const seenModuleIds = new Set<number>();
  const distinctModules: ScheduleModuleWithModule[] = [];
  for (const scheduleModule of scheduleModules) {
    if (!seenModuleIds.has(scheduleModule.module_id)) {
      seenModuleIds.add(scheduleModule.module_id);
      distinctModules.push(scheduleModule);
    }
  }

  distinctModules.sort((a, b) => {
    const groupA = a.module.module_group?.name ?? '';
    const groupB = b.module.module_group?.name ?? '';
    return groupA.localeCompare(groupB) || a.module.name.localeCompare(b.module.name);
  });

  const warnings: string[] = [];
  const usedNames = new Map<string, number>();
  const methodNameByModuleId = new Map<number, string>();
  const methods = distinctModules.map((scheduleModule) => {
    const module = scheduleModule.module;
    const subschedule = module.module_group?.subschedule ?? 0;
    const commands = commandsByModuleId.get(module.id) ?? [];
    const methodName = toJavaMethodName(module.name, usedNames);
    methodNameByModuleId.set(module.id, methodName);
    return buildMethod(module, subschedule, commands, methodName, warnings);
  });

  const bodyMethod = buildBodyMethod(schedule, scheduleModules, methodNameByModuleId);

  return { source: [...methods, bodyMethod].join('\n\n') + '\n', warnings };
}

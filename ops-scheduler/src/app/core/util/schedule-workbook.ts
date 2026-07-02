import { Fill, Workbook } from 'exceljs';

import { Command } from '../models/command.model';
import { ScheduleModuleWithModule } from '../models/schedule-module.model';
import { Schedule } from '../models/schedule.model';
import { buildModuleColorMap } from './module-colors';
import {
  absoluteTimeAtElapsedSeconds,
  commandElapsedSeconds,
  orbitPositionAtElapsedSeconds,
  scheduleModuleElapsedSeconds
} from './orbit-time';

const DATE_FORMAT = 'yyyy-mm-dd hh:mm:ss';
const NO_GROUP_LABEL = '(no group)';

interface CommandEvent {
  scheduleModule: ScheduleModuleWithModule;
  command: Command;
  elapsedSeconds: number;
}

interface ModuleBlock {
  scheduleModule: ScheduleModuleWithModule;
  startSeconds: number;
  endSeconds: number;
}

function solidFill(argb: string): Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function buildScheduleWorkbook(
  schedule: Schedule,
  scheduleModules: ScheduleModuleWithModule[],
  commandsByModuleId: Map<number, Command[]>
): Workbook {
  const workbook = new Workbook();
  workbook.created = new Date();

  const colorByModuleId = buildModuleColorMap(scheduleModules.map((sm) => sm.module_id));

  const events: CommandEvent[] = [];
  const blocks: ModuleBlock[] = [];

  for (const scheduleModule of scheduleModules) {
    const commands = commandsByModuleId.get(scheduleModule.module_id) ?? [];
    const startSeconds = scheduleModuleElapsedSeconds(schedule, scheduleModule);
    let endSeconds = startSeconds;
    for (const command of commands) {
      const elapsedSeconds = commandElapsedSeconds(schedule, scheduleModule, scheduleModule.module, command);
      events.push({ scheduleModule, command, elapsedSeconds });
      endSeconds = Math.max(endSeconds, elapsedSeconds);
    }
    blocks.push({ scheduleModule, startSeconds, endSeconds });
  }

  events.sort((a, b) => a.elapsedSeconds - b.elapsedSeconds || a.command.id - b.command.id);

  buildCommandsSheet(workbook, schedule, events, colorByModuleId);
  buildTimelineSheet(workbook, schedule, blocks, colorByModuleId);

  return workbook;
}

function buildCommandsSheet(
  workbook: Workbook,
  schedule: Schedule,
  events: CommandEvent[],
  colorByModuleId: Map<number, string>
): void {
  const sheet = workbook.addWorksheet('Commands');
  sheet.columns = [
    { header: 'Orbit #', key: 'orbitNumber', width: 10 },
    { header: 'Orbit angle (°)', key: 'orbitAngle', width: 14 },
    { header: 'Relative time (s)', key: 'relativeTime', width: 16 },
    { header: 'Absolute time', key: 'absoluteTime', width: 20 },
    { header: 'Module group', key: 'group', width: 20 },
    { header: 'Module', key: 'module', width: 20 },
    { header: 'Subschedule', key: 'subschedule', width: 12 },
    { header: 'Command', key: 'command', width: 28 }
  ];
  sheet.getRow(1).font = { bold: true };

  for (const event of events) {
    const { orbitNumber, orbitAngle } = orbitPositionAtElapsedSeconds(schedule, event.elapsedSeconds);
    const row = sheet.addRow({
      orbitNumber,
      orbitAngle: round(orbitAngle, 3),
      relativeTime: round(event.elapsedSeconds, 3),
      absoluteTime: absoluteTimeAtElapsedSeconds(schedule, event.elapsedSeconds),
      group: event.scheduleModule.module.module_group?.name ?? NO_GROUP_LABEL,
      module: event.scheduleModule.module.name,
      subschedule: event.scheduleModule.module.subschedule,
      command: event.command.name
    });
    row.getCell('absoluteTime').numFmt = DATE_FORMAT;

    const color = colorByModuleId.get(event.scheduleModule.module_id);
    if (color) {
      row.eachCell((cell) => (cell.fill = solidFill(color)));
    }
  }
}

const SECONDS_PER_MINUTE = 60;

function buildTimelineSheet(
  workbook: Workbook,
  schedule: Schedule,
  blocks: ModuleBlock[],
  colorByModuleId: Map<number, string>
): void {
  const groupNames = Array.from(
    new Set(blocks.map((block) => block.scheduleModule.module.module_group?.name ?? NO_GROUP_LABEL))
  ).sort();
  const groupColumnKeys = new Map(groupNames.map((name, index) => [name, `group_${index}`]));

  const maxSeconds = blocks.reduce((max, block) => Math.max(max, block.endSeconds), 0);
  const totalMinutes = Math.ceil(maxSeconds / SECONDS_PER_MINUTE);

  const sheet = workbook.addWorksheet('Timeline');
  sheet.columns = [
    { header: 'Orbit #', key: 'orbitNumber', width: 10 },
    { header: 'Orbit angle (°)', key: 'orbitAngle', width: 14 },
    { header: 'Relative time (s)', key: 'relativeTime', width: 16 },
    { header: 'Absolute time', key: 'absoluteTime', width: 20 },
    ...groupNames.map((name) => ({ header: name, key: groupColumnKeys.get(name), width: 18 }))
  ];
  sheet.getRow(1).font = { bold: true };

  for (let minute = 0; minute <= totalMinutes; minute++) {
    const minuteStart = minute * SECONDS_PER_MINUTE;
    const minuteEnd = minuteStart + SECONDS_PER_MINUTE;
    const { orbitNumber, orbitAngle } = orbitPositionAtElapsedSeconds(schedule, minuteStart);
    const row = sheet.addRow({
      orbitNumber,
      orbitAngle: round(orbitAngle, 3),
      relativeTime: minuteStart,
      absoluteTime: absoluteTimeAtElapsedSeconds(schedule, minuteStart)
    });
    row.getCell('absoluteTime').numFmt = DATE_FORMAT;

    for (const block of blocks) {
      if (block.startSeconds >= minuteEnd || block.endSeconds < minuteStart) {
        continue;
      }
      const groupName = block.scheduleModule.module.module_group?.name ?? NO_GROUP_LABEL;
      const key = groupColumnKeys.get(groupName);
      const color = colorByModuleId.get(block.scheduleModule.module_id);
      if (key && color) {
        row.getCell(key).fill = solidFill(color);
      }
    }
  }
}

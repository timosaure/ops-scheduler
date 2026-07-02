import { Fill, Workbook } from 'exceljs';

import { Command } from '../models/command.model';
import { ScheduleModuleWithModule } from '../models/schedule-module.model';
import { Schedule } from '../models/schedule.model';
import { buildModuleColorMap } from './module-colors';
import {
  absoluteTimeAtElapsedSeconds,
  commandElapsedSeconds,
  formatDurationSeconds,
  orbitPositionAtElapsedSeconds,
  scheduleModuleElapsedSeconds,
} from './orbit-time';

const DATE_FORMAT = 'yyyy-mm-dd hh:mm:ss\\.000';
const RELATIVE_SECONDS_FORMAT = '0\\.000';
const NO_GROUP_LABEL = '(no group)';
const HEADER_FILL_COLOR = 'FFD9D9D9';

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
  commandsByModuleId: Map<number, Command[]>,
): Workbook {
  const workbook = new Workbook();
  workbook.created = new Date();

  const colorByModuleId = buildModuleColorMap(scheduleModules.map((sm) => sm.module_id));

  const events: CommandEvent[] = [];
  const blocks: ModuleBlock[] = [];

  for (const scheduleModule of scheduleModules) {
    const commands = commandsByModuleId.get(scheduleModule.module_id) ?? [];
    let startSeconds = scheduleModuleElapsedSeconds(schedule, scheduleModule);

    // The block should start with the first command not the module start as the first command in the module might come
    // after a significant delay
    if (commands.length > 0) {
      startSeconds = commandElapsedSeconds(
        schedule,
        scheduleModule,
        scheduleModule.module,
        commands[0],
      );
    }

    let endSeconds = startSeconds;
    for (const command of commands) {
      const elapsedSeconds = commandElapsedSeconds(
        schedule,
        scheduleModule,
        scheduleModule.module,
        command,
      );
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
  colorByModuleId: Map<number, string>,
): void {
  const sheet = workbook.addWorksheet('Commands');
  sheet.columns = [
    { header: 'Absolute time', key: 'absoluteTime', width: 24 },
    {
      header: 'Relative time',
      key: 'relativeTimeFormatted',
      width: 17,
      style: { alignment: { horizontal: 'right' } },
    },
    {
      header: 'Relative time (s)',
      key: 'relativeTime',
      width: 16,
      style: { alignment: { horizontal: 'right' }, numFmt: RELATIVE_SECONDS_FORMAT },
    },
    { header: 'Orbit number', key: 'orbitNumber', width: 10 },
    { header: 'Orbit angle (°)', key: 'orbitAngle', width: 14 },
    { header: 'Module group', key: 'group', width: 20 },
    { header: 'Module', key: 'module', width: 20 },
    { header: 'Subschedule', key: 'subschedule', width: 12 },
    { header: 'Upload', key: 'upload', width: 12 },
    { header: 'Command', key: 'command', width: 256 },
  ];
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = solidFill(HEADER_FILL_COLOR);

  for (const event of events) {
    const { orbitNumber, orbitAngle } = orbitPositionAtElapsedSeconds(
      schedule,
      event.elapsedSeconds,
    );
    const row = sheet.addRow({
      absoluteTime: absoluteTimeAtElapsedSeconds(schedule, event.elapsedSeconds),
      relativeTimeFormatted: formatDurationSeconds(event.elapsedSeconds),
      relativeTime: round(event.elapsedSeconds, 3),
      orbitNumber,
      orbitAngle: round(orbitAngle, 3),
      group: event.scheduleModule.module.module_group?.name ?? NO_GROUP_LABEL,
      module: event.scheduleModule.module.name,
      subschedule: event.scheduleModule.module.module_group?.subschedule,
      upload: event.scheduleModule.module.upload,
      command: event.command.name,
    });
    row.getCell('absoluteTime').numFmt = DATE_FORMAT;

    const color = colorByModuleId.get(event.scheduleModule.module_id);
    if (color) {
      row.eachCell((cell) => (cell.fill = solidFill(color)));
    }
  }
}

const SECONDS_PER_MINUTE = 60;

interface GroupColumnKeys {
  nameKey: string;
  timeKey: string;
}

function buildTimelineSheet(
  workbook: Workbook,
  schedule: Schedule,
  blocks: ModuleBlock[],
  colorByModuleId: Map<number, string>,
): void {
  const groupNames = Array.from(
    new Set(
      blocks.map((block) => block.scheduleModule.module.module_group?.name ?? NO_GROUP_LABEL),
    ),
  ).sort();
  const groupColumns = new Map<string, GroupColumnKeys>(
    groupNames.map((name, index) => [
      name,
      { nameKey: `group_${index}_name`, timeKey: `group_${index}_time` },
    ]),
  );

  const subscheduleByGroup = new Map<string, number>();
  for (const block of blocks) {
    const groupName = block.scheduleModule.module.module_group?.name ?? NO_GROUP_LABEL;
    if (!subscheduleByGroup.has(groupName)) {
      const subschedule = block.scheduleModule.module.module_group?.subschedule;
      if (subschedule !== undefined) {
        subscheduleByGroup.set(groupName, subschedule);
      }
    }
  }

  const maxSeconds = blocks.reduce((max, block) => Math.max(max, block.endSeconds), 0);
  const totalMinutes = Math.ceil(maxSeconds / SECONDS_PER_MINUTE);

  const sheet = workbook.addWorksheet('Timeline');
  sheet.columns = [
    { header: 'Absolute time', key: 'absoluteTime', width: 24 },
    {
      header: 'Relative time',
      key: 'relativeTimeFormatted',
      width: 17,
      style: { alignment: { horizontal: 'right' } },
    },
    {
      header: 'Relative time (s)',
      key: 'relativeTime',
      width: 16,
      style: { alignment: { horizontal: 'right' }, numFmt: RELATIVE_SECONDS_FORMAT },
    },
    { header: 'Orbit number', key: 'orbitNumber', width: 10 },
    { header: 'Orbit angle (°)', key: 'orbitAngle', width: 14 },
    ...groupNames.flatMap((name) => {
      const columns = groupColumns.get(name)!;
      const subschedule = subscheduleByGroup.get(name);
      const timeHeader = subschedule !== undefined ? `SSchId=${subschedule}` : '';
      return [
        { header: name, key: columns.nameKey, width: 18 },
        {
          header: timeHeader,
          key: columns.timeKey,
          width: 28,
          style: { alignment: { horizontal: 'right' as const } },
        },
      ];
    }),
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = solidFill(HEADER_FILL_COLOR);

  for (let minute = 0; minute <= totalMinutes; minute++) {
    const minuteStart = minute * SECONDS_PER_MINUTE;
    const { orbitNumber, orbitAngle } = orbitPositionAtElapsedSeconds(schedule, minuteStart);
    const row = sheet.addRow({
      absoluteTime: absoluteTimeAtElapsedSeconds(schedule, minuteStart),
      relativeTimeFormatted: formatDurationSeconds(minuteStart),
      relativeTime: minuteStart,
      orbitNumber,
      orbitAngle: round(orbitAngle, 3),
    });
    row.getCell('absoluteTime').numFmt = DATE_FORMAT;
  }

  for (const block of blocks) {
    const groupName = block.scheduleModule.module.module_group?.name ?? NO_GROUP_LABEL;
    const columns = groupColumns.get(groupName);
    const color = colorByModuleId.get(block.scheduleModule.module_id);
    if (!columns || !color) {
      continue;
    }

    const startRow = Math.floor(block.startSeconds / SECONDS_PER_MINUTE) + 2;
    const endRow = Math.floor(block.endSeconds / SECONDS_PER_MINUTE) + 2;
    const fill = solidFill(color);

    for (let rowNumber = startRow; rowNumber <= endRow; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      row.getCell(columns.nameKey).fill = fill;
      row.getCell(columns.timeKey).fill = fill;
    }

    const headerLine = sheet.getRow(startRow);
    headerLine.getCell(columns.nameKey).value = block.scheduleModule.module.name;
    const startTimeCell = headerLine.getCell(columns.timeKey);
    startTimeCell.value = absoluteTimeAtElapsedSeconds(schedule, block.startSeconds);
    startTimeCell.numFmt = DATE_FORMAT;

    if (endRow > startRow) {
      const secondLine = sheet.getRow(startRow + 1);
      secondLine.getCell(columns.nameKey).value = block.scheduleModule.module.upload;
      secondLine.getCell(columns.timeKey).value = formatDurationSeconds(
        block.endSeconds - block.startSeconds,
      );
    }
  }
}

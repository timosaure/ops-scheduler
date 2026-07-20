import { Command } from '../models/command.model';
import { Module } from '../models/module.model';
import { ScheduleModuleWithModule } from '../models/schedule-module.model';
import { Schedule } from '../models/schedule.model';
import { buildScheduleJavaSource } from './schedule-java-export';

const ORBIT_DURATION_SECONDS = 6000;

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 1,
    name: 'Test schedule',
    start_time: '2026-01-01T00:00:00Z',
    start_orbit_number: 5,
    start_orbit_angle: 300,
    orbit_duration_seconds: ORBIT_DURATION_SECONDS,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeModule(overrides: Partial<Module> = {}): Module {
  return {
    id: 1,
    module_group_id: 1,
    name: 'Test module',
    type: 'MTL',
    created_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

function makeScheduleModule(
  module: Module,
  overrides: Partial<Omit<ScheduleModuleWithModule, 'module'>> = {},
  moduleGroup: { name: string; subschedule: number } | null = { name: 'Group A', subschedule: 2 }
): ScheduleModuleWithModule {
  return {
    id: 1,
    schedule_id: 1,
    module_id: module.id,
    relative_time: null,
    delta_orbit_number: null,
    delta_orbit_angle: null,
    upload: 'NOT_LIVE',
    position: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
    module: { ...module, module_group: moduleGroup }
  };
}

function makeCommand(overrides: Partial<Command> = {}): Command {
  return {
    id: 1,
    module_id: 1,
    name: 'invoke(new DH_NM_002_Test().Sid(3));',
    relative_time: null,
    relative_orbit_angle: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides
  };
}

const schedule = makeSchedule();

describe('buildScheduleJavaSource', () => {
  describe('NOT_LIVE uploads', () => {
    it('generates an MTL method with a zero-offset command using baseTime directly', () => {
      const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'MTL' });
      const scheduleModule = makeScheduleModule(module);
      const command = makeCommand({ module_id: 1, relative_time: null });
      const commandsByModuleId = new Map([[1, [command]]]);

      const { source, warnings } = buildScheduleJavaSource(schedule, [scheduleModule], commandsByModuleId);

      expect(warnings).toEqual([]);
      expect(source).toContain('public void dhHousekeeping(IAbsoluteTime baseTime) {');
      expect(source).toContain(
        'invoke(new DH_NM_002T_Test().Sid(3).RefTime(DateTimeUtil.toString(baseTime)).Ssid(2).Groupid(0));'
      );
    });

    it('generates an MTL method with a non-zero offset using baseTime.add(...)', () => {
      const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'MTL' });
      const scheduleModule = makeScheduleModule(module);
      const command = makeCommand({ module_id: 1, relative_time: 'PT0.05S' });
      const commandsByModuleId = new Map([[1, [command]]]);

      const { source } = buildScheduleJavaSource(schedule, [scheduleModule], commandsByModuleId);

      expect(source).toContain(
        'invoke(new DH_NM_002T_Test().Sid(3).RefTime(DateTimeUtil.toString(baseTime.add(DateTimeUtil.duration(50, UnitsEapl.ms)))).Ssid(2).Groupid(0));'
      );
    });

    it('generates an OPS method with orbit number/angle parameters', () => {
      const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'OPS' });
      const scheduleModule = makeScheduleModule(module);
      const command = makeCommand({ module_id: 1, relative_orbit_angle: 32.4 });
      const commandsByModuleId = new Map([[1, [command]]]);

      const { source, warnings } = buildScheduleJavaSource(schedule, [scheduleModule], commandsByModuleId);

      expect(warnings).toEqual([]);
      expect(source).toContain('public void dhHousekeeping(int orbitNumber, double deltaAngle) {');
      expect(source).toContain(
        'invoke(new DH_NM_002P_Test().Sid(3).OrbitNumber(orbitNumber).OrbitAng(deltaAngle + 32.4).Ssid(2).Groupid(0).RepeatCycle(0));'
      );
    });

    it('subtracts a negative relative_orbit_angle instead of adding a negative literal', () => {
      const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'OPS' });
      const scheduleModule = makeScheduleModule(module);
      const command = makeCommand({ module_id: 1, relative_orbit_angle: -12.3 });
      const commandsByModuleId = new Map([[1, [command]]]);

      const { source } = buildScheduleJavaSource(schedule, [scheduleModule], commandsByModuleId);

      expect(source).toContain('.OrbitAng(deltaAngle - 12.3)');
    });

    it('uses deltaAngle directly for a zero relative_orbit_angle', () => {
      const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'OPS' });
      const scheduleModule = makeScheduleModule(module);
      const command = makeCommand({ module_id: 1, relative_orbit_angle: null });
      const commandsByModuleId = new Map([[1, [command]]]);

      const { source } = buildScheduleJavaSource(schedule, [scheduleModule], commandsByModuleId);

      expect(source).toContain('.OrbitAng(deltaAngle)');
    });

    it('emits a TODO comment when the class name does not match the expected XX_YY_NNN pattern', () => {
      const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'MTL' });
      const scheduleModule = makeScheduleModule(module);
      const command = makeCommand({ module_id: 1, name: 'invoke(new UnexpectedClassName().Sid(3));' });
      const commandsByModuleId = new Map([[1, [command]]]);

      const { source, warnings } = buildScheduleJavaSource(schedule, [scheduleModule], commandsByModuleId);

      expect(source).toContain('// TODO: could not parse command, insert manually:');
      expect(warnings.length).toBe(1);
    });
  });

  describe('LIVE uploads', () => {
    it('invokes the command directly, without the T/P class name marker or scheduling modifiers', () => {
      const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'MTL' });
      const scheduleModule = makeScheduleModule(module, { upload: 'LIVE' });
      const command = makeCommand({ module_id: 1, relative_time: null });
      const commandsByModuleId = new Map([[1, [command]]]);

      const { source, warnings } = buildScheduleJavaSource(schedule, [scheduleModule], commandsByModuleId);

      expect(warnings).toEqual([]);
      expect(source).toContain('public void dhHousekeepingLive(IAbsoluteTime baseTime) {');
      expect(source).toContain('invoke(new DH_NM_002_Test().Sid(3));');
      expect(source).not.toContain('RefTime');
      expect(source).not.toContain('DH_NM_002T_Test');
    });

    it('inserts a waitFor before a command with a non-zero MTL offset, and skips it for a zero offset', () => {
      const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'MTL' });
      const scheduleModule = makeScheduleModule(module, { upload: 'LIVE' });
      const commands = [
        makeCommand({ id: 1, module_id: 1, name: 'invoke(new DH_NM_001_Test().Sid(3));', relative_time: null }),
        makeCommand({ id: 2, module_id: 1, name: 'invoke(new DH_NM_002_Test().Sid(3));', relative_time: 'PT0.05S' })
      ];
      const commandsByModuleId = new Map([[1, commands]]);

      const { source } = buildScheduleJavaSource(schedule, [scheduleModule], commandsByModuleId);

      const methodStart = source.indexOf('public void dhHousekeepingLive');
      const methodBody = source.slice(methodStart);
      const lines = methodBody
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

      expect(lines[1]).toBe('invoke(new DH_NM_001_Test().Sid(3));');
      expect(lines[2]).toBe('waitFor(DateTimeUtil.duration(50, UnitsEapl.ms));');
      expect(lines[3]).toBe('invoke(new DH_NM_002_Test().Sid(3));');
    });

    it('converts an OPS command offset to a waitFor duration using the orbit period', () => {
      const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'OPS' });
      const scheduleModule = makeScheduleModule(module, { upload: 'LIVE' });
      // A quarter orbit at a 6000s period is 1500s = 1_500_000ms.
      const command = makeCommand({ module_id: 1, relative_orbit_angle: 90 });
      const commandsByModuleId = new Map([[1, [command]]]);

      const { source, warnings } = buildScheduleJavaSource(schedule, [scheduleModule], commandsByModuleId);

      expect(warnings).toEqual([]);
      expect(source).toContain('public void dhHousekeepingLive(int orbitNumber, double deltaAngle) {');
      expect(source).toContain('waitFor(DateTimeUtil.duration(1500000, UnitsEapl.ms));');
      expect(source).toContain('invoke(new DH_NM_002_Test().Sid(3));');
      expect(source).not.toContain('OrbitNumber');
    });

    it('still emits a TODO and warning for a command that cannot be parsed as an invocation', () => {
      const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'MTL' });
      const scheduleModule = makeScheduleModule(module, { upload: 'LIVE' });
      const command = makeCommand({ module_id: 1, name: 'someUnexpectedFormat()' });
      const commandsByModuleId = new Map([[1, [command]]]);

      const { source, warnings } = buildScheduleJavaSource(schedule, [scheduleModule], commandsByModuleId);

      expect(source).toContain('// TODO: could not parse command, insert manually: someUnexpectedFormat()');
      expect(warnings).toEqual(['Module "DH Housekeeping": could not parse command "someUnexpectedFormat()"']);
    });

    it('does not require the XX_YY_NNN class name pattern, since no T/P transform is applied', () => {
      const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'MTL' });
      const scheduleModule = makeScheduleModule(module, { upload: 'LIVE' });
      const command = makeCommand({ module_id: 1, name: 'invoke(new UnexpectedClassName().Sid(3));' });
      const commandsByModuleId = new Map([[1, [command]]]);

      const { source, warnings } = buildScheduleJavaSource(schedule, [scheduleModule], commandsByModuleId);

      expect(warnings).toEqual([]);
      expect(source).toContain('invoke(new UnexpectedClassName().Sid(3));');
    });
  });

  it('de-duplicates method names derived from identical module names', () => {
    const moduleA = makeModule({ id: 1, name: 'DH Housekeeping', type: 'MTL' });
    const moduleB = makeModule({ id: 2, name: 'DH Housekeeping', type: 'MTL' });
    const scheduleModules = [
      makeScheduleModule(moduleA, {}, { name: 'Group A', subschedule: 2 }),
      makeScheduleModule(moduleB, { id: 2 }, { name: 'Group B', subschedule: 2 })
    ];
    const commandsByModuleId = new Map([
      [1, [makeCommand({ module_id: 1 })]],
      [2, [makeCommand({ module_id: 2 })]]
    ]);

    const { source } = buildScheduleJavaSource(schedule, scheduleModules, commandsByModuleId);

    expect(source).toContain('public void dhHousekeeping(IAbsoluteTime baseTime) {');
    expect(source).toContain('public void dhHousekeeping2(IAbsoluteTime baseTime) {');
  });

  it('only generates one method per distinct module, even if placed multiple times in the schedule', () => {
    const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'MTL' });
    const scheduleModules = [makeScheduleModule(module), makeScheduleModule(module, { id: 2 })];
    const commandsByModuleId = new Map([[1, [makeCommand({ module_id: 1 })]]]);

    const { source } = buildScheduleJavaSource(schedule, scheduleModules, commandsByModuleId);

    expect(source.match(/public void/g)?.length).toBe(2); // the module method + body()
  });

  it('generates two separate methods when the same module is placed as both LIVE and NOT_LIVE', () => {
    const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'MTL' });
    const scheduleModules = [
      makeScheduleModule(module, { id: 1, upload: 'NOT_LIVE' }),
      makeScheduleModule(module, { id: 2, upload: 'LIVE', relative_time: 'PT10S' })
    ];
    const commandsByModuleId = new Map([[1, [makeCommand({ module_id: 1 })]]]);

    const { source } = buildScheduleJavaSource(schedule, scheduleModules, commandsByModuleId);

    expect(source.match(/public void/g)?.length).toBe(3); // one method per upload variant + body()
    expect(source).toContain('public void dhHousekeeping(IAbsoluteTime baseTime) {');
    expect(source).toContain('public void dhHousekeepingLive(IAbsoluteTime baseTime) {');
    expect(source).toContain(
      'invoke(new DH_NM_002T_Test().Sid(3).RefTime(DateTimeUtil.toString(baseTime)).Ssid(2).Groupid(0));'
    );
    expect(source).toContain('invoke(new DH_NM_002_Test().Sid(3));');

    const bodyStart = source.indexOf('public void body() {');
    const bodySource = source.slice(bodyStart);
    expect(bodySource).toContain('dhHousekeeping(');
    expect(bodySource).toContain('dhHousekeepingLive(');
  });

  it('emits a TODO comment and a warning for a command that cannot be parsed', () => {
    const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'MTL' });
    const scheduleModule = makeScheduleModule(module);
    const command = makeCommand({ module_id: 1, name: 'someUnexpectedFormat()' });
    const commandsByModuleId = new Map([[1, [command]]]);

    const { source, warnings } = buildScheduleJavaSource(schedule, [scheduleModule], commandsByModuleId);

    expect(source).toContain('// TODO: could not parse command, insert manually: someUnexpectedFormat()');
    expect(warnings).toEqual(['Module "DH Housekeeping": could not parse command "someUnexpectedFormat()"']);
  });

  describe('body()', () => {
    it('calls an MTL module method with the absolute time the module starts at', () => {
      const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'MTL' });
      const scheduleModule = makeScheduleModule(module, { relative_time: 'PT10S' });
      const commandsByModuleId = new Map([[1, [makeCommand({ module_id: 1 })]]]);

      const { source } = buildScheduleJavaSource(schedule, [scheduleModule], commandsByModuleId);

      expect(source).toContain('public void body() {');
      expect(source).toContain('dhHousekeeping(DateTimeUtil.absoluteTime("2026-01-01T00:00:10.000"));');
    });

    it('calls an OPS module method with the resolved orbit number and angle the module starts at', () => {
      const module = makeModule({ id: 1, name: 'DH Housekeeping', type: 'OPS' });
      const scheduleModule = makeScheduleModule(module, { delta_orbit_number: 1, delta_orbit_angle: 90 });
      const commandsByModuleId = new Map([[1, [makeCommand({ module_id: 1 })]]]);

      const { source } = buildScheduleJavaSource(schedule, [scheduleModule], commandsByModuleId);

      expect(source).toContain('public void body() {');
      expect(source).toContain('dhHousekeeping(6, 90);');
    });

    it('calls modules in schedule order, once per placement, using the shared per-module method', () => {
      const moduleA = makeModule({ id: 1, name: 'First', type: 'MTL' });
      const moduleB = makeModule({ id: 2, name: 'Second', type: 'MTL' });
      const scheduleModules = [
        makeScheduleModule(moduleA, { relative_time: 'PT0S' }),
        makeScheduleModule(moduleB, { id: 2, module_id: 2, relative_time: 'PT20S' }),
        makeScheduleModule(moduleA, { id: 3, relative_time: 'PT40S' })
      ];
      const commandsByModuleId = new Map([
        [1, [makeCommand({ module_id: 1 })]],
        [2, [makeCommand({ module_id: 2 })]]
      ]);

      const { source } = buildScheduleJavaSource(schedule, scheduleModules, commandsByModuleId);

      const bodyStart = source.indexOf('public void body() {');
      const bodySource = source.slice(bodyStart);
      const calls = bodySource.match(/^\s*(first|second)\(.*\);$/gm) ?? [];
      expect(calls.length).toBe(3);
      expect(calls[0]).toContain('first(');
      expect(calls[1]).toContain('second(');
      expect(calls[2]).toContain('first(');
    });
  });
});

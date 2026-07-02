import { Module } from '../models/module.model';
import { Schedule } from '../models/schedule.model';
import { ScheduleModule } from '../models/schedule-module.model';
import { commandElapsedSeconds, orbitPositionAtElapsedSeconds, scheduleModuleElapsedSeconds } from './orbit-time';

const ORBIT_DURATION_SECONDS = 6000;

function makeSchedule(startOrbitNumber: number, startOrbitAngle: number): Schedule {
  return {
    id: 1,
    name: 'Test schedule',
    start_time: '2026-01-01T00:00:00Z',
    start_orbit_number: startOrbitNumber,
    start_orbit_angle: startOrbitAngle,
    orbit_duration_seconds: ORBIT_DURATION_SECONDS,
    created_at: '2026-01-01T00:00:00Z'
  };
}

function makeScheduleModule(deltaOrbitNumber: number | null, deltaOrbitAngle: number | null): ScheduleModule {
  return {
    id: 1,
    schedule_id: 1,
    module_id: 1,
    relative_time: null,
    delta_orbit_number: deltaOrbitNumber,
    delta_orbit_angle: deltaOrbitAngle,
    created_at: '2026-01-01T00:00:00Z'
  };
}

const opsModule: Module = {
  id: 1,
  module_group_id: 1,
  name: 'Test OPS module',
  type: 'OPS',
  upload: 'LIVE',
  created_at: '2026-01-01T00:00:00Z'
};

function orbitPositionForCommand(
  schedule: Schedule,
  scheduleModule: ScheduleModule,
  relativeOrbitAngle: number
) {
  const elapsedSeconds = commandElapsedSeconds(schedule, scheduleModule, opsModule, {
    id: 1,
    module_id: 1,
    name: 'Test command',
    relative_time: null,
    relative_orbit_angle: relativeOrbitAngle,
    created_at: '2026-01-01T00:00:00Z'
  });
  return orbitPositionAtElapsedSeconds(schedule, elapsedSeconds);
}

describe('orbit-time', () => {
  describe('delta_orbit_number >= 1 (full orbit, absolute angle)', () => {
    it('places the command at start_orbit_number + delta_orbit_number, ignoring start_orbit_angle', () => {
      const schedule = makeSchedule(5, 300);
      const scheduleModule = makeScheduleModule(1, 0);

      const position = orbitPositionForCommand(schedule, scheduleModule, 49);

      expect(position.orbitNumber).toBe(6);
      expect(position.orbitAngle).toBeCloseTo(49, 6);
    });

    it('gives the same angle regardless of start_orbit_angle', () => {
      const scheduleModule = makeScheduleModule(1, 0);

      const withOffsetStart = orbitPositionForCommand(makeSchedule(5, 300), scheduleModule, 49);
      const withZeroStart = orbitPositionForCommand(makeSchedule(5, 0), scheduleModule, 49);

      expect(withOffsetStart.orbitAngle).toBeCloseTo(withZeroStart.orbitAngle, 6);
      expect(withOffsetStart.orbitNumber).toBe(withZeroStart.orbitNumber);
    });
  });

  describe('delta_orbit_number == 0 (partial starting orbit, angle builds on start_orbit_angle)', () => {
    it('adds delta_orbit_angle and the command angle onto start_orbit_angle', () => {
      const schedule = makeSchedule(5, 300);
      const scheduleModule = makeScheduleModule(0, 10);

      const position = orbitPositionForCommand(schedule, scheduleModule, 5);

      expect(position.orbitNumber).toBe(5);
      expect(position.orbitAngle).toBeCloseTo(315, 6);
    });

    it('rolls over into the next orbit when the combined angle exceeds 360 degrees', () => {
      const schedule = makeSchedule(5, 300);
      const scheduleModule = makeScheduleModule(0, 70);

      const position = orbitPositionForCommand(schedule, scheduleModule, 5);

      expect(position.orbitNumber).toBe(6);
      expect(position.orbitAngle).toBeCloseTo(15, 6);
    });

    it('treats a null delta_orbit_number the same as 0', () => {
      const schedule = makeSchedule(5, 300);
      const scheduleModule = makeScheduleModule(null, 10);

      const position = orbitPositionForCommand(schedule, scheduleModule, 5);

      expect(position.orbitNumber).toBe(5);
      expect(position.orbitAngle).toBeCloseTo(315, 6);
    });
  });

  describe('scheduleModuleElapsedSeconds', () => {
    it('for delta_orbit_number 0, depends only on delta_orbit_angle, not start_orbit_angle', () => {
      const scheduleModule = makeScheduleModule(0, 10);
      const expectedSeconds = (10 / 360) * ORBIT_DURATION_SECONDS;

      expect(scheduleModuleElapsedSeconds(makeSchedule(5, 300), scheduleModule)).toBeCloseTo(expectedSeconds, 6);
      expect(scheduleModuleElapsedSeconds(makeSchedule(5, 0), scheduleModule)).toBeCloseTo(expectedSeconds, 6);
    });

    it('is negative when delta_orbit_angle is negative, i.e. before the scenario start', () => {
      const schedule = makeSchedule(5, 300);
      const scheduleModule = makeScheduleModule(0, -10);

      expect(scheduleModuleElapsedSeconds(schedule, scheduleModule)).toBeLessThan(0);
    });

    it('uses relative_time directly for MTL-style placement, ignoring orbit fields', () => {
      const schedule = makeSchedule(5, 300);
      const scheduleModule: ScheduleModule = {
        ...makeScheduleModule(1, 90),
        relative_time: 'PT10S'
      };

      expect(scheduleModuleElapsedSeconds(schedule, scheduleModule)).toBe(10);
    });
  });
});

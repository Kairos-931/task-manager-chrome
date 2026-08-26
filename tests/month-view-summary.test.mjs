import assert from 'node:assert/strict'
import { summarizeTaskDurationsForDates, shiftMonth } from '../shared/calendar.ts'

const task = (overrides = {}) => ({
  id: 'task',
  title: 'Task',
  description: '',
  priority: 'medium',
  category: '',
  dueDate: '2026-07-08',
  duration: 60,
  repeatType: 'none',
  repeatDays: [],
  repeatInterval: 1,
  completed: false,
  completedDates: [],
  createdAt: 0,
  updatedAt: 0,
  noTimeLimit: false,
  ...overrides,
})

const tasks = [
  task({ id: 'july-pending', dueDate: '2026-07-08', duration: 60 }),
  task({ id: 'july-done', dueDate: '2026-07-10', duration: 120, completed: true }),
  task({ id: 'august-pending', dueDate: '2026-08-03', duration: 300 }),
  task({ id: 'untimed', dueDate: '2026-07-12', duration: 600, noTimeLimit: true }),
  task({
    id: 'daily',
    dueDate: '2026-07-01',
    repeatStartDate: '2026-07-01',
    repeatType: 'daily',
    duration: 30,
    completedDates: ['2026-07-01'],
  }),
]

assert.deepEqual(
  summarizeTaskDurationsForDates(tasks, ['2026-07-01', '2026-07-08', '2026-07-10']),
  { pending: 120, done: 150 },
  'July summary should include only July occurrences and split recurring completion state'
)
assert.deepEqual(
  summarizeTaskDurationsForDates(tasks, ['2026-08-03']),
  { pending: 330, done: 0 },
  'August summary should update to August occurrences'
)
assert.equal(shiftMonth('2026-03-31', -1), '2026-02-01', 'previous month should not overflow from a 31-day date')
assert.equal(shiftMonth('2026-01-31', 1), '2026-02-01', 'next month should not overflow from a 31-day date')

console.log('Month view summary tests passed')

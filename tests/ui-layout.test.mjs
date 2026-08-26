import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [popupSource, renderSource, eventSource, prdSource] = await Promise.all([
  readFile(new URL('../popup/popup.html', import.meta.url), 'utf8'),
  readFile(new URL('../shared/render.ts', import.meta.url), 'utf8'),
  readFile(new URL('../shared/events.ts', import.meta.url), 'utf8'),
  readFile(new URL('../docs/PRD.md', import.meta.url), 'utf8'),
])

assert.match(popupSource, /width:\s*400px/)
assert.doesNotMatch(popupSource, /width:\s*520px/)
assert.match(renderSource, /class="task-row pool-task-row/)
assert.match(renderSource, /class="task-actions pool-task-actions/)
assert.match(renderSource, /\.pool-task-actions \{[\s\S]*gap: 8px;[\s\S]*margin-left: 12px;/)
assert.match(renderSource, /@media \(max-width: 900px\)[\s\S]*\.pool-task-row \.pool-task-actions[\s\S]*padding-left: 52px/)
assert.match(renderSource, /id="splitTaskModal"[^>]*p-4 sm:p-6/)
assert.match(renderSource, /split-task-panel[^\n]*max-w-4xl/)
assert.match(renderSource, /id="splitTaskForm" class="split-task-form space-y-4"/)
assert.match(renderSource, /id="splitChildren"[^>]*max-height:min\(48svh,460px\)/)
assert.match(renderSource, /split-child-row grid gap-2 p-3 rounded-lg/)
assert.match(renderSource, /\.split-child-row \{[\s\S]*grid-template-columns: minmax\(0, 1fr\) 32px;/)
assert.match(renderSource, /\.split-child-schedule \{[\s\S]*grid-column: 1 \/ -1;[\s\S]*grid-template-columns: 132px minmax\(0, 1fr\) 126px;/)
assert.match(renderSource, /split-child-field-label">预计时间/)
assert.match(renderSource, /split-child-field-label">自定义日期/)
assert.match(renderSource, /\.split-child-duration-control \{[\s\S]*width: 132px;[\s\S]*grid-template-columns: 34px 56px 34px;/)
assert.match(renderSource, /\.split-child-duration-control \.split-child-duration \{[\s\S]*width: 56px;[\s\S]*min-width: 0;/)
assert.doesNotMatch(renderSource, /split-child-duration-field[\s\S]{0,160}class="flex items-center gap-1"/)
assert.doesNotMatch(eventSource, /split-child-duration-field[\s\S]{0,160}class="flex items-center gap-1"/)
assert.match(renderSource, /@media \(max-width: 520px\)[\s\S]*\.split-child-duration-field \{ grid-column: 1; grid-row: 1; \}[\s\S]*\.split-child-date-field \{ grid-column: 2; grid-row: 1; \}[\s\S]*\.split-quick-dates \{ grid-column: 1 \/ -1; grid-row: 2; \}/)
assert.match(eventSource, /split-child-schedule[\s\S]*split-child-duration-field[\s\S]*split-quick-dates[\s\S]*split-child-date-field/)
assert.match(renderSource, /id="splitTaskModal"[\s\S]*role="dialog"[\s\S]*aria-modal="true"/)
assert.match(eventSource, /splitTaskModal[\s\S]*addEventListener\('keydown',[\s\S]*key === 'Escape'[\s\S]*closeSplitModal\(\)/)
assert.match(renderSource, /class="app-header-actions ml-auto flex flex-col items-end/)
assert.match(renderSource, /class="header-utility-actions w-full flex items-center justify-end/)
assert.match(renderSource, /\.header-utility-actions \{[\s\S]*justify-content: flex-end;/)
assert.match(renderSource, /\.split-task-footer \{[\s\S]*justify-content: flex-end;/)
assert.doesNotMatch(renderSource, /class="app-shell/)
assert.doesNotMatch(renderSource, /class="filter-bar/)
assert.match(prdSource, /仅任务池操作区换到任务信息下方/)
assert.match(prdSource, /子任务列表单独限高并在内容较多时内部滚动/)
assert.match(prdSource, /400px[^\n]*预计时间与自定义日期并排[^\n]*不依赖横向滚动/)
assert.match(prdSource, /预计时间步进器[^\n]*确定宽度[^\n]*工具类/)

console.log('Targeted task pool UI layout tests passed')

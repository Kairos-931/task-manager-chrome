const overdueFold = document.querySelector('#overdueFold')
const overdueTasks = document.querySelector('#overdueTasks')

overdueFold.addEventListener('click', () => {
  overdueTasks.hidden = !overdueTasks.hidden
  overdueFold.setAttribute('aria-expanded', String(!overdueTasks.hidden))
  overdueFold.lastElementChild.textContent = overdueTasks.hidden ? '展开' : '收起'
  overdueFold.querySelector('b').textContent = `${overdueTasks.hidden ? '▸' : '▾'} 今日之前`
})

document.querySelectorAll('.more').forEach(button => {
  button.addEventListener('click', () => {
    const task = button.closest('.task')
    const menu = task.querySelector('.menu')
    document.querySelectorAll('.menu').forEach(item => {
      if (item !== menu) item.hidden = true
    })
    menu.hidden = !menu.hidden
  })
})

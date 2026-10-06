/** An open task editor must not be replaced during a remote refresh. */
export const isInteractiveTaskModalOpen = (container: ParentNode): boolean => {
  const taskModal = container.querySelector('#taskModal')
  const splitTaskModal = container.querySelector('#splitTaskModal')
  return [taskModal, splitTaskModal]
    .some(modal => !!modal && !modal.classList.contains('hidden'))
}

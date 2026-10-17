import type { Download } from './protocol'

export function downloadFile(file: Download) {
  const url = URL.createObjectURL(new Blob([file.buffer], { type: file.mime }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = file.filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

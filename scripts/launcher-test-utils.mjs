export async function exitWithin(promise, timeout = 15_000) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Child did not exit within ${timeout}ms`)),
          timeout,
        )
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** 图片宽度 */
const width = 320

/** 图片高度, 高度会根据输入流宽高比自动调整 */
let height = 0

/** 是否正在实时抓取摄像头图像 */
let streaming = false

const video = /** @type HTMLVideoElement */(document.getElementById('video'))
const canvas = /** @type HTMLCanvasElement */(document.getElementById('canvas'))
const photo = document.getElementById('photo')
const gallery = document.querySelector('.gallery')
const takePhotoButton = document.getElementById('takePhoto')
const addPhotoButton = document.getElementById('addPhoto')

/** 拍照 */
function takePhoto () {
  const context = canvas.getContext('2d')
  if (width && height) {
    canvas.width = width
    canvas.height = height
    context.drawImage(video, 0, 0, width, height)

    const data = canvas.toDataURL('image/png')
    photo.setAttribute('src', data)
  } else {
    clearPhoto()
  }
}

/** 清空当前照片 */
function clearPhoto () {
  const context = canvas.getContext('2d')
  context.fillStyle = '#eee'
  context.fillRect(0, 0, canvas.width, canvas.height)

  const data = canvas.toDataURL('image/png')
  photo.setAttribute('src', data)
}

/** 将当前照片添加到相册 */
function addPhoto () {
  gallery.appendChild(photo.cloneNode(true))
}

navigator.getUserMedia(
  {
    video: true,
    audio: false
  },
  function (stream) {
    video.srcObject = stream
    video.play()
  },
  function (err) {
    console.log('An error occured! ' + err)
  }
)

video.addEventListener('canplay', function (ev) {
  if (!streaming) {
    height = video.videoHeight / (video.videoWidth/width)
    video.setAttribute('width', String(width))
    video.setAttribute('height', String(height))
    canvas.setAttribute('width', String(width))
    canvas.setAttribute('height', String(height))
    streaming = true
  }
}, false)

takePhotoButton.onclick = takePhoto
addPhotoButton.onclick = addPhoto

clearPhoto()

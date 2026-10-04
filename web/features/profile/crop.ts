export type CropSettings = {zoom: number; rotation: number; x: number; y: number};
export const initialCrop: CropSettings = {zoom: 1, rotation: 0, x: 0, y: 0};
export function cropGeometry(width: number, height: number, settings: CropSettings, size = 200) {
  const swapped = Math.abs(settings.rotation % 180) === 90;
  const rotatedWidth = swapped ? height : width, rotatedHeight = swapped ? width : height;
  const scale = Math.max(size / rotatedWidth, size / rotatedHeight) * settings.zoom;
  const panX = Math.max(0, (rotatedWidth * scale - size) / 2), panY = Math.max(0, (rotatedHeight * scale - size) / 2);
  return {scale, panX, panY, offsetX: settings.x / 100 * panX, offsetY: settings.y / 100 * panY};
}
export function drawCrop(canvas: HTMLCanvasElement, image: HTMLImageElement, settings: CropSettings) {
  const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas is unavailable.');
  const size = 200; canvas.width = size; canvas.height = size;
  const geometry = cropGeometry(image.naturalWidth, image.naturalHeight, settings, size);
  context.clearRect(0,0,size,size); context.save();
  context.translate(size / 2 + geometry.offsetX, size / 2 + geometry.offsetY);
  context.rotate(settings.rotation * Math.PI / 180); context.scale(geometry.scale, geometry.scale);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2); context.restore();
}

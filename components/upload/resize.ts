// Shrinks a screenshot in the browser before upload. Owner: Sam (A).
// 1600 px wide JPEG keeps 5 images well under Vercel's 4.5 MB request limit
// while fee text stays readable. Tall fee pages keep their height up to a cap.
const MAX_WIDTH = 1600;
const MAX_HEIGHT = 4800;
const QUALITY = 0.85;

export async function resizeToJpeg(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width, MAX_HEIGHT / bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser can't prepare images.");
  // JPEG has no transparency; paint white so transparent PNGs don't turn black.
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", QUALITY);
}

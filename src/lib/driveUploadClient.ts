// Browser side of uploading straight to Google Drive: sends a file to a
// one-time resumable upload link in 8 MB pieces, and after a dropped
// connection asks Google how much it has and carries on from there.

const CHUNK = 8 * 1024 * 1024; // multiple of 256 KB, as Google requires

type Reply = { status: number; range: string | null; body: string };

function put(url: string, headers: Record<string, string>, body: Blob | null, onProgress?: (loaded: number) => void) {
  return new Promise<Reply>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    if (onProgress) xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => resolve({ status: xhr.status, range: xhr.getResponseHeader("Range"), body: xhr.responseText });
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("network"));
    xhr.timeout = 180_000;
    xhr.send(body);
  });
}

const nextOffset = (range: string | null) => (range ? Number(range.split("-")[1]) + 1 : 0);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type UploadEvents = {
  onProgress: (sentBytes: number) => void;
  onConnectionLost: () => void;
  onResumed: () => void;
};

// Returns the Drive file id once the whole file is in Drive.
export async function uploadToDrive(url: string, file: File, events: UploadEvents): Promise<string> {
  let offset = 0;
  const done = (body: string) => String(JSON.parse(body).id);
  for (;;) {
    const end = Math.min(offset + CHUNK, file.size);
    try {
      const r = await put(url, { "Content-Range": `bytes ${offset}-${end - 1}/${file.size}` }, file.slice(offset, end), (loaded) =>
        events.onProgress(offset + loaded)
      );
      if (r.status === 200 || r.status === 201) {
        events.onProgress(file.size);
        return done(r.body);
      }
      if (r.status === 308) {
        offset = nextOffset(r.range);
        events.onProgress(offset);
        continue;
      }
      if (r.status < 500) throw new Error(`Google refused the upload (${r.status}).`);
      throw new Error("network");
    } catch (error) {
      if ((error as Error).message !== "network") throw error;
      events.onConnectionLost();
      // Wait for the internet, then ask Google where it stopped.
      for (;;) {
        while (typeof navigator !== "undefined" && !navigator.onLine) await wait(1000);
        await wait(2000);
        try {
          const s = await put(url, { "Content-Range": `bytes */${file.size}` }, null);
          if (s.status === 200 || s.status === 201) {
            events.onProgress(file.size);
            return done(s.body);
          }
          if (s.status === 404 || s.status === 410) throw new Error("The upload expired. Please try again.");
          offset = nextOffset(s.range);
          events.onProgress(offset);
          break;
        } catch (e) {
          if ((e as Error).message !== "network") throw e;
        }
      }
      events.onResumed();
    }
  }
}

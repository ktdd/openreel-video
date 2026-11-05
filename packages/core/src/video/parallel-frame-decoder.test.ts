import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ParallelFrameDecoder } from "./parallel-frame-decoder";
import type { WorkerRequest, WorkerResponse } from "./decode-worker-types";

const workers: MockWorker[] = [];
class MockWorker {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn<[WorkerRequest], void>();
  terminate = vi.fn();

  constructor(readonly url: URL, readonly options: WorkerOptions) {
    workers.push(this);
  }

  respond(response: WorkerResponse): void {
    this.onmessage?.({ data: response } as MessageEvent<WorkerResponse>);
  }
}

let decoder: ParallelFrameDecoder;

beforeEach(() => {
  workers.length = 0;
  vi.stubGlobal("Worker", MockWorker);
  vi.stubGlobal("navigator", { hardwareConcurrency: 4 });
  vi.stubGlobal("fetch", vi.fn());
  vi.spyOn(URL, "createObjectURL");
  vi.spyOn(console, "error").mockImplementation(() => {});
  decoder = new ParallelFrameDecoder(1);
});
afterEach(() => {
  decoder.dispose();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("bundled decode worker startup", () => {
  it("creates one module worker from its entry URL and shares initialization", async () => {
    const first = decoder.initialize();
    const second = decoder.initialize();
    expect(workers).toHaveLength(1);
    expect(workers[0].url.pathname).toMatch(/\/decode-worker\.ts$/);
    expect(workers[0].options).toEqual({ type: "module" });
    expect(workers[0].postMessage).toHaveBeenCalledWith({ type: "init" });
    expect(decoder.isAvailable()).toBe(false);

    workers[0].respond({ type: "ready", workerId: 42, mediabunnyAvailable: true });
    await Promise.all([first, second]);
    await decoder.initialize();
    expect(decoder.isAvailable()).toBe(true);
    expect(workers).toHaveLength(1);
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("terminates a worker whose module fails to start without fetching a fallback", async () => {
    const pending = decoder.initialize();
    const rejected = expect(pending).rejects.toMatchObject({ message: "Module failed" });
    workers[0].onerror?.({ message: "Module failed" } as ErrorEvent);
    await rejected;
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(decoder.isAvailable()).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("terminates a worker that never acknowledges initialization", async () => {
    vi.useFakeTimers();
    const pending = decoder.initialize();
    const rejected = expect(pending).rejects.toThrow("Worker 0 initialization timed out");
    await vi.advanceTimersByTimeAsync(10000);
    await rejected;
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(decoder.isAvailable()).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

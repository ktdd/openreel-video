export interface DecodeRequest {
  type: "decode";
  requestId: string;
  clipId: string;
  blob: Blob;
  time: number;
  width: number;
  height: number;
}

export interface DecodeResponse {
  type: "decoded";
  requestId: string;
  clipId: string;
  bitmap: ImageBitmap | null;
  time: number;
  error?: string;
}

export interface InitRequest {
  type: "init";
}

export interface InitResponse {
  type: "ready";
  workerId: number;
  mediabunnyAvailable: boolean;
}

export type WorkerRequest = DecodeRequest | InitRequest;
export type WorkerResponse = DecodeResponse | InitResponse;

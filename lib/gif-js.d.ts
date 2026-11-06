declare module "gif.js" {
  interface GIFOptions {
    workers?: number;
    quality?: number;
    width?: number;
    height?: number;
    workerScript?: string;
    repeat?: number;
  }

  interface AddFrameOptions {
    delay?: number;
    copy?: boolean;
  }

  export default class GIF {
    constructor(options?: GIFOptions);
    addFrame(image: CanvasImageSource | CanvasRenderingContext2D, options?: AddFrameOptions): void;
    on(event: "finished", cb: (blob: Blob) => void): void;
    on(event: "progress", cb: (p: number) => void): void;
    render(): void;
  }
}

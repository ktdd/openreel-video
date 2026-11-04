import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { MotionComposition } from "@openreel/core";
import { createEmptyProject } from "../../stores/project/project-helpers";
import { useProjectStore } from "../../stores/project-store";
import { useMotionStore } from "../stores/motion-store";
import { RenderQueuePanel } from "./RenderQueuePanel";

const composition: MotionComposition = {
  id: "comp-guardrail", name: "Guardrail Comp", width: 1280, height: 720,
  frameRate: 30, duration: 4, backgroundColor: "#101820", layers: [], assets: [],
  variables: [], markers: [], createdAt: 1, modifiedAt: 1,
};
const warning = /This export will encode H\.264 without transparency/i;
const startButton = () => screen.getByRole("button", { name: /start render queue/i });
function seedJob(format: "mp4" | "mov-prores4444", complete = false) {
  useMotionStore.setState({ renderQueue: [{
    id: "job-1", compositionId: composition.id, name: composition.name,
    width: 1280, height: 720, frameRate: 30, duration: 4, format,
    status: complete ? "complete" : "queued", progress: complete ? 100 : 0,
    createdAt: 1, outputFilename: complete ? "guardrail.mp4" : undefined,
  }] });
}
describe("browser render queue format guardrail", () => {
  beforeEach(() => {
    useProjectStore.setState({ hasOpenProject: true, project: { ...createEmptyProject("Guardrail"), motionCompositions: [composition] } });
    useMotionStore.setState({ renderQueue: [] });
  });
  afterEach(() => {
    cleanup();
    delete (window as { openreel?: unknown }).openreel;
    useProjectStore.setState({ hasOpenProject: false });
    useMotionStore.setState({ renderQueue: [] });
  });
  it.each(["mov-prores4444", "webm-alpha"])("requires explicit H.264 acknowledgement for %s", (format) => {
    seedJob("mp4");
    render(<RenderQueuePanel composition={composition} embedded />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: format } });
    expect(screen.getByText(warning)).toBeInTheDocument();
    expect(screen.getByText(/Choose PNG Sequence for transparent output/)).toBeInTheDocument();
    expect(startButton()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /export as h\.264 anyway/i }));
    expect(startButton()).not.toBeDisabled();
  });
  it.each(["mp4", "png-sequence"])("does not warn for supported %s output", (format) => {
    render(<RenderQueuePanel composition={composition} embedded />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: format } });
    expect(screen.queryByText(warning)).not.toBeInTheDocument();
  });
  it("cannot bypass the guardrail with a retired desktop bridge", () => {
    Object.defineProperty(window, "openreel", { configurable: true, value: { platform: "desktop" } });
    seedJob("mp4");
    render(<RenderQueuePanel composition={composition} embedded />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "mov-prores4444" } });
    expect(screen.getByText(warning)).toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });
  it("states the actual encoded format on a completed ProRes-requested job", () => {
    seedJob("mov-prores4444", true);
    render(<RenderQueuePanel composition={composition} embedded />);
    expect(screen.getByText(/Encoded H\.264 \(ProRes unavailable on web\)/)).toBeInTheDocument();
  });
});

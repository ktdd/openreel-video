import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ExportProgressOverlay } from "./ExportProgressOverlay";

afterEach(cleanup);

describe("ExportProgressOverlay media labels", () => {
  it("keeps video as the default export label", () => {
    render(<ExportProgressOverlay progress={25} phase="rendering..." width={640} height={360} />);
    expect(screen.getByRole("status")).toHaveTextContent("Exporting video");
    expect(screen.getByRole("status")).toHaveTextContent("Rendering");
    expect(screen.getByRole("progressbar", { name: "Video export" })).toHaveAttribute("aria-valuenow", "25");
  });

  it.each([{ width: 640, height: 360 }, { width: 280, height: 160 }])("labels audio exports at normal and compact sizes: %j", (size) => {
    render(<ExportProgressOverlay progress={56.6} phase="encoding..." mediaType="audio" {...size} />);
    expect(screen.getByRole("status")).toHaveTextContent("Exporting audio");
    expect(screen.getByRole("status")).toHaveTextContent("Encoding");
    expect(screen.queryByText("Exporting video")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Audio export" })).toHaveAttribute("aria-valuenow", "57");
  });

  it("preserves the audio accessibility label when the visual title is shortened", () => {
    render(<ExportProgressOverlay progress={10} phase="preparing..." mediaType="audio" width={200} height={80} />);
    expect(screen.getByText("Exporting", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Preparing");
    expect(screen.getByRole("progressbar", { name: "Audio export" })).toBeInTheDocument();
    expect(screen.queryByRole("progressbar", { name: "Video export" })).not.toBeInTheDocument();
  });

  it("changes the visible and accessible labels for successive export types", () => {
    const { rerender } = render(<ExportProgressOverlay progress={20} phase="encoding..." mediaType="audio" width={640} height={360} />);
    rerender(<ExportProgressOverlay progress={30} phase="rendering..." mediaType="video" width={640} height={360} />);
    expect(screen.getByRole("status")).toHaveTextContent("Exporting video");
    expect(screen.queryByText("Exporting audio")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Video export" })).toHaveAttribute("aria-valuenow", "30");
  });

  it.each([[-10, "0"], [150, "100"], [NaN, "0"]])("clamps audio progress %s to %s", (progress, expected) => {
    render(<ExportProgressOverlay progress={progress} phase="" mediaType="audio" width={640} height={360} />);
    expect(screen.getByRole("progressbar", { name: "Audio export" })).toHaveAttribute("aria-valuenow", expected);
    expect(screen.getByRole("status")).toHaveTextContent("Preparing");
  });
});

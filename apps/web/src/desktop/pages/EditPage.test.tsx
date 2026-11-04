import "../../test/install-local-storage-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("../../components/editor/AssetsPanel", () => ({ AssetsPanel: () => <div>Media panel</div> }));
vi.mock("../../components/editor/InspectorPanel", () => ({ InspectorPanel: () => <div>Inspector panel</div> }));
vi.mock("../../components/editor/Preview", () => ({ Preview: () => <div>Preview panel</div> }));
vi.mock("../../components/editor/Timeline", () => ({ Timeline: () => <div>Timeline panel</div> }));

import { EditPage } from "./EditPage";

describe("desktop manual editing dock", () => {
  beforeEach(() => { window.localStorage.clear(); });
  afterEach(() => { cleanup(); window.localStorage.clear(); });

  it("retains media, viewer, inspector, timeline and their three resize handles without chat", async () => {
    render(<EditPage />);
    expect(await screen.findByText("Preview panel")).toBeInTheDocument();
    expect(await screen.findByText("Timeline panel")).toBeInTheDocument();
    expect(screen.getByText("Media panel")).toBeInTheDocument();
    expect(screen.getByText("Inspector panel")).toBeInTheDocument();
    expect(screen.getAllByRole("separator")).toHaveLength(3);
    const grid = screen.getByTestId("desktop-edit-page");
    expect(grid.style.gridTemplateAreas).toBe("'media stage inspector' 'timeline timeline timeline'");
    expect(grid.style.gridTemplateAreas).not.toContain("chat");
    expect(screen.queryByText(/AI Editor/)).toBeNull();
  });

  it("keeps current persisted manual panel sizes", () => {
    localStorage.setItem("openreel-desktop-media-w", "400");
    localStorage.setItem("openreel-desktop-inspector-w", "420");
    localStorage.setItem("openreel-desktop-timeline-h", "240");
    render(<EditPage />);
    const grid = screen.getByTestId("desktop-edit-page");
    expect(grid.style.gridTemplateColumns).toBe("400px 1fr 420px");
    expect(grid.style.gridTemplateRows).toBe("1fr 240px");
  });
});

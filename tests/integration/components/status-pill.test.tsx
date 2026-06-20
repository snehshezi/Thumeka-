import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusPill } from "@/components/status-pill";

describe("StatusPill", () => {
  it("renders a readable label for status values", () => {
    render(<StatusPill status="awaiting_provider_acceptance" />);

    expect(screen.getByText("Awaiting Provider Acceptance")).toBeInTheDocument();
  });
});

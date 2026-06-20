import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/empty-state";

describe("EmptyState", () => {
  it("renders the title and body", () => {
    render(<EmptyState body="No records yet." title="Nothing here" />);

    expect(screen.getByRole("heading", { name: "Nothing here" })).toBeInTheDocument();
    expect(screen.getByText("No records yet.")).toBeInTheDocument();
  });
});

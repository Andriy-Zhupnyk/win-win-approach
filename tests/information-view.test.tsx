import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { InformationStatus } from "@prisma/client";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { InformationView } from "@/components/information-view";
import type { LocalizedVersion } from "@/lib/information";

// The locale-aware Link pulls in next/navigation, which can't load outside
// Next; a plain anchor is enough for these assertions.
vi.mock("@/i18n/navigation", () => ({
  Link: (props: ComponentProps<"a"> & { href: string }) => <a {...props} />,
}));

const version: LocalizedVersion = {
  id: "v1",
  versionLabel: "GS 0.1",
  title: "General Statement",
  body: "First paragraph.\n\nSecond paragraph.",
  status: InformationStatus.ARCHIVED,
  publishedAt: new Date("2026-08-15T12:00:00Z"),
};

function renderView(isCurrent: boolean) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <InformationView version={version} isCurrent={isCurrent} />
    </NextIntlClientProvider>,
  );
}

describe("InformationView", () => {
  it("renders the title, paragraphs, label and publish date for current content", () => {
    renderView(true);
    expect(
      screen.getByRole("heading", { name: "General Statement" }),
    ).toBeInTheDocument();
    expect(screen.getByText("First paragraph.")).toBeInTheDocument();
    expect(screen.getByText("Second paragraph.")).toBeInTheDocument();
    expect(screen.getByText(/GS 0\.1/)).toHaveTextContent("August 15, 2026");
    expect(screen.queryByTestId("archived-banner")).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Version history" }),
    ).toBeInTheDocument();
  });

  it("flags non-current content as archived", () => {
    renderView(false);
    expect(screen.getByTestId("archived-banner")).toHaveTextContent(
      "archived version (GS 0.1)",
    );
    expect(
      screen.getByRole("link", { name: "View the current version" }),
    ).toBeInTheDocument();
  });
});

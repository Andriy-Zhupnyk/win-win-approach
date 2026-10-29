import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import messages from "@/messages/en.json";
import Home from "@/app/[locale]/page";

describe("Home page", () => {
  it("renders the translated heading", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <Home />
      </NextIntlClientProvider>,
    );
    expect(
      screen.getByRole("heading", { name: /win-win approach/i }),
    ).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AIChatSidebar } from "@/components/AIChatSidebar";
import * as api from "@/lib/api";

vi.mock("@/lib/api");

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.sendChat).mockResolvedValue({ reply: "I can help!", board_updated: false });
});

describe("AIChatSidebar", () => {
  it("renders input and send button", () => {
    render(<AIChatSidebar onBoardUpdate={() => {}} onClose={() => {}} />);
    expect(screen.getByLabelText("Chat input")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send message/i })).toBeInTheDocument();
  });

  it("renders AI Assistant heading", () => {
    render(<AIChatSidebar onBoardUpdate={() => {}} onClose={() => {}} />);
    expect(screen.getByText("AI Assistant")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    render(<AIChatSidebar onBoardUpdate={() => {}} onClose={onClose} />);
    await userEvent.click(screen.getByLabelText("Close sidebar"));
    expect(onClose).toHaveBeenCalled();
  });

  it("sends a message and displays reply", async () => {
    render(<AIChatSidebar onBoardUpdate={() => {}} onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText("Chat input"), "Create a task");
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => expect(screen.getByText("Create a task")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByText("I can help!")).toBeInTheDocument());
  });

  it("clears input after sending", async () => {
    render(<AIChatSidebar onBoardUpdate={() => {}} onClose={() => {}} />);
    const input = screen.getByLabelText("Chat input");
    await userEvent.type(input, "Hello");
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("calls onBoardUpdate when board_updated is true", async () => {
    vi.mocked(api.sendChat).mockResolvedValue({ reply: "Created a card.", board_updated: true });
    const onBoardUpdate = vi.fn();
    render(<AIChatSidebar onBoardUpdate={onBoardUpdate} onClose={() => {}} />);

    await userEvent.type(screen.getByLabelText("Chat input"), "Add a card");
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => expect(onBoardUpdate).toHaveBeenCalled());
  });

  it("does not call onBoardUpdate when board_updated is false", async () => {
    const onBoardUpdate = vi.fn();
    render(<AIChatSidebar onBoardUpdate={onBoardUpdate} onClose={() => {}} />);

    await userEvent.type(screen.getByLabelText("Chat input"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => screen.getByText("I can help!"));
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("shows loading state while waiting for response", async () => {
    let resolve: (v: api.ChatResponse) => void;
    vi.mocked(api.sendChat).mockReturnValue(
      new Promise((r) => { resolve = r; })
    );

    render(<AIChatSidebar onBoardUpdate={() => {}} onClose={() => {}} />);
    await userEvent.type(screen.getByLabelText("Chat input"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    expect(screen.getByText("Thinking...")).toBeInTheDocument();
    resolve!({ reply: "Done", board_updated: false });
    await waitFor(() => expect(screen.queryByText("Thinking...")).not.toBeInTheDocument());
  });

  it("passes conversation history with subsequent messages", async () => {
    render(<AIChatSidebar onBoardUpdate={() => {}} onClose={() => {}} />);

    await userEvent.type(screen.getByLabelText("Chat input"), "First message");
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => screen.getByText("I can help!"));

    await userEvent.type(screen.getByLabelText("Chat input"), "Second message");
    await userEvent.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => expect(api.sendChat).toHaveBeenCalledTimes(2));
    const secondCall = vi.mocked(api.sendChat).mock.calls[1];
    expect(secondCall[1]).toHaveLength(2); // history has user + assistant messages
  });
});

import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { KanbanBoard } from "@/components/KanbanBoard";
import * as api from "@/lib/api";

vi.mock("@/lib/api");

const mockBoard: api.ApiBoard = {
  id: 1,
  title: "My Board",
  columns: [
    {
      id: 1,
      title: "Backlog",
      cards: [
        { id: 1, title: "Card 1", details: "Details 1", position: 0 },
        { id: 2, title: "Card 2", details: "Details 2", position: 1 },
      ],
    },
    { id: 2, title: "Discovery", cards: [] },
    { id: 3, title: "In Progress", cards: [] },
    { id: 4, title: "Review", cards: [] },
    { id: 5, title: "Done", cards: [] },
  ],
};

beforeEach(() => {
  vi.mocked(api.getBoard).mockResolvedValue(mockBoard);
  vi.mocked(api.renameColumn).mockResolvedValue(undefined);
  vi.mocked(api.createCard).mockResolvedValue({
    id: 99,
    title: "New card",
    details: "Notes",
    position: 0,
  });
  vi.mocked(api.deleteCard).mockResolvedValue(undefined);
  vi.mocked(api.moveCard).mockResolvedValue(undefined);
});

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

describe("KanbanBoard", () => {
  it("renders five columns after loading", async () => {
    render(<KanbanBoard onLogout={() => {}} />);
    await waitFor(() =>
      expect(screen.getAllByTestId(/column-/i)).toHaveLength(5)
    );
  });

  it("renames a column locally", async () => {
    render(<KanbanBoard onLogout={() => {}} />);
    await waitFor(() => screen.getAllByTestId(/column-/i));
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard onLogout={() => {}} />);
    await waitFor(() => screen.getAllByTestId(/column-/i));
    const column = getFirstColumn();

    await userEvent.click(
      within(column).getByRole("button", { name: /add a card/i })
    );

    await userEvent.type(
      within(column).getByPlaceholderText(/card title/i),
      "New card"
    );
    await userEvent.type(
      within(column).getByPlaceholderText(/details/i),
      "Notes"
    );
    await userEvent.click(
      within(column).getByRole("button", { name: /add card/i })
    );

    await waitFor(() =>
      expect(within(column).getByText("New card")).toBeInTheDocument()
    );

    await userEvent.click(
      within(column).getByRole("button", { name: /delete new card/i })
    );

    await waitFor(() =>
      expect(within(column).queryByText("New card")).not.toBeInTheDocument()
    );
  });
});

/**
 * What an empty page asks for. In the dashboard a portfolio asks for its first project and shows the
 * three ways to add one; anywhere else (the team area's editors) the empty state's one button adds a
 * link, so its words ask for a link too: one message, not a project heading over a link button.
 */
export const emptyPageAsk = (portfolio: boolean, inShell: boolean): "work" | "link" => (portfolio && inShell ? "work" : "link");

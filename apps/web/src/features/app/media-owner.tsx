"use client";

import { createContext, useContext } from "react";

/**
 * Whose media folder the editor's pictures go into. Null (the default) is the signed-in account. The
 * team's proposal editor names the customer: a proposal's pictures belong to the customer's account
 * (they are deleted with it, and stay when the team member's account goes), not to whoever built it.
 */
const MediaOwnerContext = createContext<string | null>(null);

export const MediaOwnerProvider = MediaOwnerContext.Provider;

export const useMediaOwner = (): string | null => useContext(MediaOwnerContext);

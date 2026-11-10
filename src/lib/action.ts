export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  /** set when the session is gone: the form offers to sign in again */
  sessionExpired?: boolean;
};

export const initialState: ActionState = {};

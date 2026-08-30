export type FormData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  rememberMe: boolean;
  acceptTerms: boolean;
};

export type Errors = Partial<
  Record<
    | 'firstName'
    | 'lastName'
    | 'email'
    | 'password'
    | 'confirmPassword',
    string
  >
>;

// 'forgot' asks for the reset email; 'reset' is where the emailed link lands,
// carrying the one-time token. Two modes because they are two steps taken
// minutes apart, usually on different devices -- the screen that requests the
// link cannot be the screen that sets the password, because at that point
// nobody has proved anything yet.
export type Mode = 'signin' | 'signup' | 'forgot' | 'reset';

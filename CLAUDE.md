When you have a function with more than one parameter with the same type, use an object parameter instead of positional parameters:

// BAD
const addUserToPost = (userId: string, postId: string) => {};

// GOOD
const addUserToPost = (opts: { userId: string; postId: string }) => {};

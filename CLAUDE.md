// BAD
const addUserToPost = (userId: string, postId: string) => {};

// GOOD
const addUserToPost = (opts: { userId: string; postId: string }) => {};
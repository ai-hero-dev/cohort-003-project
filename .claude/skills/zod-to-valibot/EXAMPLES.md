# Zod to Valibot: Real-World Migration Examples

## Example 1: User registration form

```ts
// ---- ZOD ----
import { z } from 'zod';

const RegisterSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8).max(100),
  confirmPassword: z.string(),
  age: z.number().int().positive().optional(),
  role: z.enum(['student', 'instructor']).default('student'),
  acceptTos: z.literal(true),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: 'Passwords must match', path: ['confirmPassword'] }
);

type RegisterInput = z.infer<typeof RegisterSchema>;

// ---- VALIBOT ----
import * as v from 'valibot';

const RegisterSchema = v.pipe(
  v.object({
    email: v.pipe(v.string(), v.email(), v.toLowerCase(), v.trim()),
    password: v.pipe(v.string(), v.minLength(8), v.maxLength(100)),
    confirmPassword: v.string(),
    age: v.optional(v.pipe(v.number(), v.integer(), v.gtValue(0))),
    role: v.optional(v.picklist(['student', 'instructor']), 'student'),
    acceptTos: v.literal(true),
  }),
  v.forward(
    v.partialCheck(
      [['password'], ['confirmPassword']],
      (input) => input.password === input.confirmPassword,
      'Passwords must match'
    ),
    ['confirmPassword']
  )
);

type RegisterInput = v.InferOutput<typeof RegisterSchema>;
```

## Example 2: API response with discriminated union

```ts
// ---- ZOD ----
const ApiResponse = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('success'),
    data: z.object({
      id: z.string().uuid(),
      items: z.array(z.string()).nonempty(),
      metadata: z.record(z.string(), z.unknown()),
    }),
  }),
  z.object({
    status: z.literal('error'),
    code: z.number().int(),
    message: z.string(),
  }),
]);

type ApiResponse = z.infer<typeof ApiResponse>;

// ---- VALIBOT ----
const ApiResponse = v.variant('status', [
  v.object({
    status: v.literal('success'),
    data: v.object({
      id: v.pipe(v.string(), v.uuid()),
      items: v.pipe(v.array(v.string()), v.nonEmpty()),
      metadata: v.record(v.string(), v.unknown()),
    }),
  }),
  v.object({
    status: v.literal('error'),
    code: v.pipe(v.number(), v.integer()),
    message: v.string(),
  }),
]);

type ApiResponse = v.InferOutput<typeof ApiResponse>;
```

## Example 3: Form handling with safeParse and error display

```ts
// ---- ZOD ----
import { z, ZodError } from 'zod';

const ContactSchema = z.object({
  name: z.string().min(2, 'Name too short'),
  email: z.string().email('Invalid email'),
  message: z.string().min(10).max(1000),
});

function handleSubmit(formData: FormData) {
  const result = ContactSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  });

  if (!result.success) {
    const errors = result.error.flatten();
    return { errors: errors.fieldErrors };
  }

  return sendEmail(result.data);
}

// ---- VALIBOT ----
import * as v from 'valibot';

const ContactSchema = v.object({
  name: v.pipe(v.string(), v.minLength(2, 'Name too short')),
  email: v.pipe(v.string(), v.email('Invalid email')),
  message: v.pipe(v.string(), v.minLength(10), v.maxLength(1000)),
});

function handleSubmit(formData: FormData) {
  const result = v.safeParse(ContactSchema, {
    name: formData.get('name'),
    email: formData.get('email'),
    message: formData.get('message'),
  });

  if (!result.success) {
    const errors = v.flatten<typeof ContactSchema>(result.issues);
    return { errors: errors.nested };
  }

  return sendEmail(result.output);
}
```

## Example 4: Nested objects with pick/omit/partial

```ts
// ---- ZOD ----
const AddressSchema = z.object({
  street: z.string(),
  city: z.string(),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}$/),
  country: z.string().default('US'),
});

const UserSchema = z.object({
  name: z.string(),
  address: AddressSchema,
  shippingAddress: AddressSchema.partial(),
});

const UpdateUserSchema = UserSchema.pick({ name: true }).extend({
  address: AddressSchema.omit({ country: true }),
});

// ---- VALIBOT ----
const AddressSchema = v.object({
  street: v.string(),
  city: v.string(),
  state: v.pipe(v.string(), v.length(2)),
  zip: v.pipe(v.string(), v.regex(/^\d{5}$/)),
  country: v.optional(v.string(), 'US'),
});

const UserSchema = v.object({
  name: v.string(),
  address: AddressSchema,
  shippingAddress: v.partial(AddressSchema),
});

const UpdateUserSchema = v.object({
  ...v.pick(UserSchema, ['name']).entries,
  address: v.omit(AddressSchema, ['country']),
});
```

## Example 5: Coercion from form data

```ts
// ---- ZOD ----
const FilterSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  active: z.coerce.boolean().default(true),
});

// ---- VALIBOT ----
const FilterSchema = v.object({
  page: v.optional(
    v.pipe(v.unknown(), v.transform(Number), v.number(), v.integer(), v.gtValue(0)),
    1
  ),
  limit: v.optional(
    v.pipe(v.unknown(), v.transform(Number), v.number(), v.integer(), v.minValue(1), v.maxValue(100)),
    20
  ),
  search: v.optional(v.pipe(v.string(), v.trim())),
  active: v.optional(
    v.pipe(v.unknown(), v.transform(Boolean), v.boolean()),
    true
  ),
});
```

## Example 6: Native enum and instanceof

```ts
// ---- ZOD ----
enum Status { Active = 'active', Inactive = 'inactive' }

const EventSchema = z.object({
  status: z.nativeEnum(Status),
  error: z.instanceof(Error).optional(),
  tags: z.set(z.string()),
  data: z.map(z.string(), z.number()),
});

// ---- VALIBOT ----
enum Status { Active = 'active', Inactive = 'inactive' }

const EventSchema = v.object({
  status: v.enum(Status),
  error: v.optional(v.instance(Error)),
  tags: v.set(v.string()),
  data: v.map(v.string(), v.number()),
});
```

## Example 7: Recursive schema

```ts
// ---- ZOD ----
type TreeNode = {
  value: string;
  children: TreeNode[];
};

const TreeNodeSchema: z.ZodType<TreeNode> = z.object({
  value: z.string(),
  children: z.lazy(() => TreeNodeSchema.array()),
});

// ---- VALIBOT ----
type TreeNode = {
  value: string;
  children: TreeNode[];
};

const TreeNodeSchema: v.GenericSchema<TreeNode> = v.object({
  value: v.string(),
  children: v.array(v.lazy(() => TreeNodeSchema)),
});
```

## Example 8: Transform with type change

```ts
// ---- ZOD ----
const DateStringSchema = z.string()
  .datetime()
  .transform((val) => new Date(val));

type DateInput = z.input<typeof DateStringSchema>;   // string
type DateOutput = z.output<typeof DateStringSchema>;  // Date

// ---- VALIBOT ----
const DateStringSchema = v.pipe(
  v.string(),
  v.isoDateTime(),
  v.transform((val) => new Date(val))
);

type DateInput = v.InferInput<typeof DateStringSchema>;   // string
type DateOutput = v.InferOutput<typeof DateStringSchema>;  // Date
```

## Example 9: Strict object and passthrough

```ts
// ---- ZOD ----
const StrictConfig = z.object({ key: z.string() }).strict();
const LooseConfig = z.object({ key: z.string() }).passthrough();
const CatchallConfig = z.object({ key: z.string() }).catchall(z.unknown());

// ---- VALIBOT ----
const StrictConfig = v.strictObject({ key: v.string() });
const LooseConfig = v.looseObject({ key: v.string() });
const CatchallConfig = v.objectWithRest({ key: v.string() }, v.unknown());
```

## Example 10: Error handling migration

```ts
// ---- ZOD ----
import { z, ZodError } from 'zod';

try {
  schema.parse(data);
} catch (e) {
  if (e instanceof ZodError) {
    console.log(e.issues);
    console.log(e.flatten());
  }
}

// ---- VALIBOT ----
import * as v from 'valibot';

try {
  v.parse(schema, data);
} catch (e) {
  if (v.isValiError(e)) {
    console.log(e.issues);
    console.log(v.flatten(e.issues));
  }
}
```

## Example 11: Intent-based action validation (React Router pattern)

```ts
// ---- ZOD ----
const ActionSchema = z.discriminatedUnion('intent', [
  z.object({ intent: z.literal('update-title'), title: z.string().min(1) }),
  z.object({ intent: z.literal('delete'), id: z.string().uuid() }),
  z.object({ intent: z.literal('publish'), id: z.string().uuid(), notify: z.coerce.boolean() }),
]);

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const result = ActionSchema.safeParse(Object.fromEntries(formData));
  if (!result.success) return json({ errors: result.error.flatten() }, 400);

  switch (result.data.intent) {
    case 'update-title': ...
    case 'delete': ...
    case 'publish': ...
  }
}

// ---- VALIBOT ----
const ActionSchema = v.variant('intent', [
  v.object({ intent: v.literal('update-title'), title: v.pipe(v.string(), v.minLength(1)) }),
  v.object({ intent: v.literal('delete'), id: v.pipe(v.string(), v.uuid()) }),
  v.object({
    intent: v.literal('publish'),
    id: v.pipe(v.string(), v.uuid()),
    notify: v.pipe(v.unknown(), v.transform(Boolean), v.boolean()),
  }),
]);

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const result = v.safeParse(ActionSchema, Object.fromEntries(formData));
  if (!result.success) return json({ errors: v.flatten(result.issues) }, 400);

  switch (result.output.intent) {
    case 'update-title': ...
    case 'delete': ...
    case 'publish': ...
  }
}
```

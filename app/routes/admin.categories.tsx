import { useState, useRef, useEffect } from "react";
import { useFetcher } from "react-router";
import { toast } from "sonner";
import * as v from "valibot";
import type { Route } from "./+types/admin.categories";
import {
  getAllCategoriesWithCourseCounts,
  createCategory,
  updateCategory,
  deleteCategory,
} from "~/services/categoryService";
import { getCurrentUserId } from "~/lib/session";
import { getUserById } from "~/services/userService";
import { parseFormData } from "~/lib/validation";
import { UserRole } from "~/db/schema";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
  AlertTriangle,
  BookOpen,
  Pencil,
  Plus,
  Tag,
  Trash2,
} from "lucide-react";
import { data, isRouteErrorResponse, Link } from "react-router";

const adminCategoryActionSchema = v.variant("intent", [
  v.object({
    intent: v.literal("create"),
    name: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, "Category name cannot be empty.")
    ),
  }),
  v.object({
    intent: v.literal("update"),
    categoryId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
    name: v.pipe(
      v.string(),
      v.trim(),
      v.minLength(1, "Category name cannot be empty.")
    ),
  }),
  v.object({
    intent: v.literal("delete"),
    categoryId: v.pipe(v.unknown(), v.transform(Number), v.integer()),
  }),
]);

export function meta() {
  return [
    { title: "Manage Categories — Cadence" },
    { name: "description", content: "Manage course categories" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("Select a user from the DevUI panel to manage categories.", {
      status: 401,
    });
  }

  const currentUser = getUserById(currentUserId);

  if (!currentUser || currentUser.role !== UserRole.Admin) {
    throw data("Only admins can access this page.", {
      status: 403,
    });
  }

  const categories = getAllCategoriesWithCourseCounts();

  return { categories };
}

export async function action({ request }: Route.ActionArgs) {
  const currentUserId = await getCurrentUserId(request);

  if (!currentUserId) {
    throw data("You must be logged in.", { status: 401 });
  }

  const currentUser = getUserById(currentUserId);
  if (!currentUser || currentUser.role !== UserRole.Admin) {
    throw data("Only admins can manage categories.", { status: 403 });
  }

  const formData = await request.formData();
  const parsed = parseFormData(formData, adminCategoryActionSchema);

  if (!parsed.success) {
    return data(
      { error: Object.values(parsed.errors)[0] ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { intent } = parsed.data;

  if (intent === "create") {
    try {
      createCategory(parsed.data.name);
      return { success: true, message: "Category created." };
    } catch (e) {
      return data(
        {
          error: e instanceof Error ? e.message : "Failed to create category.",
        },
        { status: 400 }
      );
    }
  }

  if (intent === "update") {
    try {
      updateCategory(parsed.data.categoryId, parsed.data.name);
      return { success: true, message: "Category updated." };
    } catch (e) {
      return data(
        {
          error: e instanceof Error ? e.message : "Failed to update category.",
        },
        { status: 400 }
      );
    }
  }

  if (intent === "delete") {
    try {
      deleteCategory(parsed.data.categoryId);
      return { success: true, message: "Category deleted." };
    } catch (e) {
      return data(
        {
          error: e instanceof Error ? e.message : "Failed to delete category.",
        },
        { status: 400 }
      );
    }
  }

  throw data("Invalid action.", { status: 400 });
}

function CreateCategoryRow({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fetcher = useFetcher();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.success) {
      toast.success(fetcher.data.message);
      setName("");
      onClose();
    }
    if (fetcher.state === "idle" && fetcher.data?.error) {
      toast.error(fetcher.data.error);
    }
  }, [fetcher.state, fetcher.data]);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    fetcher.submit({ intent: "create", name: trimmed }, { method: "post" });
  }

  function handleCancel() {
    setName("");
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">
        <Input
          ref={inputRef}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Category name"
          className="h-8 text-sm"
        />
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">—</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">—</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleSave}
            disabled={!name.trim() || fetcher.state !== "idle"}
          >
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleCancel}
          >
            Cancel
          </Button>
        </div>
      </td>
    </tr>
  );
}

function CategoryRow({
  category,
}: {
  category: {
    id: number;
    name: string;
    slug: string;
    courseCount: number;
  };
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(category.name);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const updateFetcher = useFetcher();
  const deleteFetcher = useFetcher();

  useEffect(() => {
    if (isEditing && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditName(category.name);
  }, [category.name]);

  useEffect(() => {
    if (updateFetcher.state === "idle" && updateFetcher.data?.success) {
      setIsEditing(false);
      toast.success(updateFetcher.data.message);
    }
    if (updateFetcher.state === "idle" && updateFetcher.data?.error) {
      toast.error(updateFetcher.data.error);
    }
  }, [updateFetcher.state, updateFetcher.data]);

  useEffect(() => {
    if (deleteFetcher.state === "idle" && deleteFetcher.data?.success) {
      toast.success(deleteFetcher.data.message);
    }
    if (deleteFetcher.state === "idle" && deleteFetcher.data?.error) {
      toast.error(deleteFetcher.data.error);
    }
  }, [deleteFetcher.state, deleteFetcher.data]);

  function handleSave() {
    const trimmed = editName.trim();
    if (!trimmed) return;
    if (trimmed === category.name) {
      setIsEditing(false);
      return;
    }
    updateFetcher.submit(
      {
        intent: "update",
        categoryId: String(category.id),
        name: trimmed,
      },
      { method: "post" }
    );
  }

  function handleCancel() {
    setEditName(category.name);
    setIsEditing(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      handleCancel();
    }
  }

  function handleDelete() {
    deleteFetcher.submit(
      { intent: "delete", categoryId: String(category.id) },
      { method: "post" }
    );
  }

  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">
        {isEditing ? (
          <Input
            ref={nameInputRef}
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 text-sm"
          />
        ) : (
          <span className="text-sm font-medium">{category.name}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-muted-foreground">{category.slug}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <BookOpen className="size-3.5" />
          {category.courseCount}
        </div>
      </td>
      <td className="px-4 py-3">
        {isEditing ? (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleSave}
              disabled={!editName.trim() || updateFetcher.state !== "idle"}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => setIsEditing(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              disabled={deleteFetcher.state !== "idle"}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

function TableRowSkeleton() {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-28" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-24" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-8" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-7 w-16" />
      </td>
    </tr>
  );
}

export function HydrateFallback() {
  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <div className="mb-8">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-2 h-5 w-72" />
      </div>
      <Skeleton className="mb-4 h-5 w-32" />
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Courses
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 4 }).map((_, i) => (
                  <TableRowSkeleton key={i} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AdminCategories({ loaderData }: Route.ComponentProps) {
  const { categories } = loaderData;
  const [isAdding, setIsAdding] = useState(false);

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-8">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link to="/" className="hover:text-foreground">
          Home
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Manage Categories</span>
      </nav>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Manage Categories</h1>
        <p className="mt-1 text-muted-foreground">
          Create, edit, and delete course categories
        </p>
      </div>

      <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Tag className="size-4" />
        <span>
          {categories.length}{" "}
          {categories.length === 1 ? "category" : "categories"} total
        </span>
      </div>

      {categories.length === 0 && !isAdding ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Tag className="mx-auto mb-3 size-8 text-muted-foreground/50" />
            <p className="mb-1 text-muted-foreground">No categories yet.</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Create your first category to start organizing courses.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="mr-1.5 size-3.5" />
              Add Category
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {(categories.length > 0 || isAdding) && (
        <>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Name
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Slug
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Courses
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => (
                      <CategoryRow key={category.id} category={category} />
                    ))}
                    {isAdding && (
                      <CreateCategoryRow onClose={() => setIsAdding(false)} />
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {!isAdding && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="mr-1.5 size-3.5" />
              Add Category
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Something went wrong";
  let message =
    "An unexpected error occurred while loading category management.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 401) {
      title = "Sign in required";
      message =
        typeof error.data === "string"
          ? error.data
          : "Please select a user from the DevUI panel.";
    } else if (error.status === 403) {
      title = "Access denied";
      message =
        typeof error.data === "string"
          ? error.data
          : "Only admins can access this page.";
    } else {
      title = `Error ${error.status}`;
      message = typeof error.data === "string" ? error.data : error.statusText;
    }
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-6">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold">{title}</h1>
        <p className="mb-6 text-muted-foreground">{message}</p>
        <div className="flex items-center justify-center gap-3">
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

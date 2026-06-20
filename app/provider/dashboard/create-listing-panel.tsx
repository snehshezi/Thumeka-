"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useState } from "react";

import { createProviderListingAction } from "@/app/provider/dashboard/actions";
import { ListingImageUpload } from "@/components/listing-image-upload";
import type { CategoryRow } from "@/lib/database.types";

type CreateListingPanelProps = {
  categories: CategoryRow[];
  defaultAddress?: string | null;
  defaultSuburb?: string | null;
  userId: string;
  supabaseUrl: string;
};

export function CreateListingPanel({
  categories,
  defaultAddress,
  defaultSuburb,
  userId,
  supabaseUrl
}: CreateListingPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="panel">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
        data-testid="provider-create-listing-toggle"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span className="flex items-center gap-2 text-base font-semibold">
          <Plus className="h-4 w-4 text-leaf" aria-hidden="true" />
          New listing
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-5 w-5 text-black/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <form
          action={createProviderListingAction}
          className="mt-4 space-y-4"
          data-testid="provider-create-listing-form"
        >
          <ListingImageUpload userId={userId} supabaseUrl={supabaseUrl} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="label">Title</span>
              <input
                className="input"
                data-testid="provider-listing-title-input"
                name="title"
                required
              />
            </label>
            <label className="space-y-1">
              <span className="label">Category</span>
              <select
                className="input"
                data-testid="provider-listing-category-select"
                name="category_id"
                required
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block space-y-1">
            <span className="label">Description</span>
            <textarea
              className="input min-h-24"
              data-testid="provider-listing-description-input"
              name="description"
              required
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1">
              <span className="label">Type</span>
              <select
                className="input"
                data-testid="provider-listing-type-select"
                name="listing_type"
              >
                <option value="product">Product</option>
                <option value="service">Service</option>
                <option value="errand">Errand</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="label">Price</span>
              <input
                className="input"
                data-testid="provider-listing-price-input"
                min="0"
                name="price"
                required
                step="0.01"
                type="number"
              />
            </label>
            <label className="space-y-1">
              <span className="label">Suburb</span>
              <input
                className="input"
                data-testid="provider-listing-suburb-input"
                defaultValue={defaultSuburb ?? ""}
                name="suburb"
                required
              />
            </label>
          </div>
          <label className="block space-y-1">
            <span className="label">Fulfilment address</span>
            <input
              className="input"
              data-testid="provider-listing-fulfillment-address-input"
              defaultValue={defaultAddress ?? ""}
              name="fulfillment_address"
              required
            />
            <span className="hint">
              Defaults to your business address — edit it if this listing is fulfilled elsewhere. Used to calculate delivery distance.
            </span>
          </label>
          <button
            className="btn-primary w-full sm:w-auto"
            data-testid="provider-create-listing-button"
            type="submit"
          >
            Create listing
          </button>
        </form>
      ) : null}
    </div>
  );
}

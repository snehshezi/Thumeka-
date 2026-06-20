"use client";

import { updateProviderListingAction } from "@/app/provider/dashboard/actions";
import { ListingImageUpload } from "@/components/listing-image-upload";
import type { CategoryRow, ListingRow } from "@/lib/database.types";

type EditListingFormProps = {
  listing: ListingRow;
  categories: CategoryRow[];
  userId: string;
  supabaseUrl: string;
};

/**
 * Edit form for an existing listing. Mirrors CreateListingPanel's field set
 * but pre-populates each input from the row that's being edited, and posts
 * to `updateProviderListingAction` instead of create.
 */
export function EditListingForm({
  listing,
  categories,
  userId,
  supabaseUrl
}: EditListingFormProps) {
  return (
    <form
      action={updateProviderListingAction}
      className="panel space-y-4"
      data-testid="provider-edit-listing-form"
    >
      <input name="listing_id" type="hidden" value={listing.id} />
      <ListingImageUpload
        defaultStoragePath={listing.image_url}
        supabaseUrl={supabaseUrl}
        userId={userId}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="label">Title</span>
          <input
            className="input"
            data-testid="provider-edit-listing-title-input"
            defaultValue={listing.title}
            name="title"
            required
          />
        </label>
        <label className="space-y-1">
          <span className="label">Category</span>
          <select
            className="input"
            data-testid="provider-edit-listing-category-select"
            defaultValue={listing.category_id}
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
          className="input min-h-32"
          data-testid="provider-edit-listing-description-input"
          defaultValue={listing.description}
          name="description"
          required
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-1">
          <span className="label">Type</span>
          <select
            className="input"
            data-testid="provider-edit-listing-type-select"
            defaultValue={listing.listing_type}
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
            data-testid="provider-edit-listing-price-input"
            defaultValue={listing.price}
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
            data-testid="provider-edit-listing-suburb-input"
            defaultValue={listing.suburb ?? ""}
            name="suburb"
            required
          />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="label">Fulfilment address</span>
        <input
          className="input"
          data-testid="provider-edit-listing-fulfillment-address-input"
          defaultValue={listing.fulfillment_address ?? ""}
          name="fulfillment_address"
          required
        />
        <span className="hint">
          Used to calculate delivery distance. Change this only if the listing
          is fulfilled from a different location than your business address.
        </span>
      </label>
      <button
        className="btn-primary w-full sm:w-auto"
        data-testid="provider-edit-listing-save-button"
        type="submit"
      >
        Save changes
      </button>
    </form>
  );
}

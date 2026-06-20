-- Constrain documents.document_type to the union the app actually knows how
-- to render. Anything inserted with an unknown type would otherwise render as
-- a raw underscore-string on the admin card and confuse approvers. The values
-- mirror lib/storage.ts → DocumentType.

alter table public.documents
  drop constraint if exists documents_document_type_check;

alter table public.documents
  add constraint documents_document_type_check
    check (
      document_type in (
        'id_document',
        'proof_of_address',
        'bank_confirmation',
        'business_registration',
        'drivers_licence',
        'vehicle_licence_disc'
      )
    );

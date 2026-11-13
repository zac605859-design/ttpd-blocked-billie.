# Subpage logo position fix

The shared subpage logo was positioned at `top: 8px` while retaining a vertical centering transform, which shifted it above the header and caused clipping. It is now centered at `top: 50%` with `translate(-50%, -50%)`. No gallery, homepage, data-loading, or Supabase logic was changed.

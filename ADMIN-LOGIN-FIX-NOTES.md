# Admin login fix

The admin page's event listeners had lost their element IDs, so the Sign In form was never connected to its submit handler. The missing IDs have been restored. The login handler now reports Supabase connection, authentication, and admin-role errors visibly. No user accounts, passwords, role metadata, or database records were modified.

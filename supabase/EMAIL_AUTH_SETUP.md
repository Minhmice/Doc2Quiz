# Email auth: vào app không cần xác nhận mail

## Hosted (Supabase Dashboard)

1. [Dashboard](https://supabase.com/dashboard) → chọn project.
2. **Authentication** → **Providers** → **Email**.
3. Tắt **Confirm email** (mô tả kiểu: users must confirm email before signing in — **OFF**).
4. **Authentication** → **URL configuration**:
   - **Site URL**: trùng app (dev: `http://localhost:3000`).
   - Thêm **Redirect URLs** nếu cần (preview domain, v.v.).

Sau khi tắt: `signUp` trả **session** ngay; user vào `/dashboard` bình thường.

## Local (`supabase start`)

Sau `supabase init`, file [`config.toml`](./config.toml) có sẵn:

```toml
[auth.email]
enable_confirmations = false
```

Nếu bạn đổi thành `true`, đổi lại `false` rồi `supabase stop && supabase start`.

Đồng thời chỉnh `[auth] site_url` cho khớp app (mặc định thường `http://127.0.0.1:3000`).

## User cũ vẫn kẹt “chưa confirm”

1. **Authentication** → **Users** → chọn user → **Confirm user** (nếu có), hoặc xóa user test và đăng ký lại.
2. Trong DevTools → Network: response `signUp` mà `session` null và không lỗi → gần như chắc **Confirm email vẫn bật** trên project.

## Kiểm tra nhanh sau khi chỉnh

1. Đăng ký email mới.
2. Vào `/dashboard` không bị đẩy về `/login`.
3. (Tuỳ chọn) Tab Application → cookie có session Supabase.

## Rủi ro sản phẩm

Tắt xác nhận email = email không được chứng minh là của người dùng. Chỉ phù hợp MVP / nội bộ trừ khi có lớp bảo vệ khác.

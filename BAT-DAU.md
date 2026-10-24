# Chạy The Frog trên máy của bạn

Đây là dự án Next.js độc lập. Bạn có thể sửa và chạy trong VS Code, không cần mở ChatGPT.

## Khi nhận mã nguồn qua ZIP

1. Cài Node.js phiên bản 24 trở lên nếu máy chưa có. npm đi kèm Node.js.
2. Giải nén ZIP vào thư mục bạn muốn giữ dự án lâu dài.
3. Trong VS Code, chọn **File → Open Folder** và mở thư mục có `package.json`.
4. Mở **Terminal → New Terminal**, rồi chạy lần lượt:

   ```powershell
   npm ci --ignore-scripts
   npm run dev
   ```

5. Mở địa chỉ Local được terminal hiển thị, thường là `http://localhost:3000`.

`npm ci` đọc `package-lock.json` và cài đúng phiên bản của React, Next.js cùng các thư viện khác. Bạn không cần cài riêng React lên Windows. Chạy bước cài thư viện một lần cho thư mục mới; các lần sau chỉ cần `npm run dev`.

Giữ terminal chạy khi dùng preview. Lưu thay đổi mã nguồn trong VS Code để trình duyệt cập nhật. Nhấn `Ctrl+C` trong terminal khi muốn dừng.

## Nếu tạo một dự án Next.js hoàn toàn mới

Sau khi có Node.js, mở terminal tại thư mục cha nơi bạn muốn đặt dự án:

```powershell
npx create-next-app@latest my-app
cd my-app
code .
npm run dev
```

Chọn TypeScript, Tailwind CSS, App Router, thư mục `src/` và alias `@/*` trong phần thiết lập. Công cụ sẽ tạo bộ khung và cài các thư viện nền. Sau đó bạn thêm các thư viện cần dùng, cấu hình dịch vụ và viết chức năng ứng dụng.

ZIP này đã chứa phần mã nguồn hoàn chỉnh của Phase 1, nên khi dùng ZIP hãy làm theo phần đầu tài liệu.

## Kết nối dữ liệu

Hiện kết nối Supabase/Google được để sau theo yêu cầu. Khi chưa cấu hình, ứng dụng hiển thị màn hình chờ kết nối. Hướng dẫn `.env.local`, cơ sở dữ liệu, Google sign-in, seed và tài khoản owner nằm trong `README.md`.

ZIP chứa `.env.example` để bạn điền cấu hình tại máy mình; không chứa khóa thật, `node_modules`, bộ nhớ đệm build hoặc dữ liệu khách hàng.

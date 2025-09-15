Tài liệu tích hợp VNPT SMARTCA

VNPT 1

TÀI LI ỆU TÍCH H ỢP  
VNPT SMARTCA  
Dịch vụ VNPT SMARTCA  
VNPT

Tài liệu tích hợp VNPT SMARTCA

VNPT 3


Tài liệu tích hợp VNPT SMARTCA

VNPT 4

1 Giới thiệu................................ ................................ ................................ ................ 5
1.1 Quy ư ớc sử dụng ................................ ................................ .............................. 5
1.2 Giao th ức API ................................ ................................ ................................ ... 5
2 Tài kho ản ................................ ................................ ................................ ............... 6
2.1 Tài kho ản nhà phát tri ển(3rd Party) ................................ ................................ .... 6
2.2 Tài kho ản ngư ời dùng cu ối ................................ ................................ ................ 6
3 Tích h ợp ký s ố với SmartCA ................................ ................................ ..................... 7
3.1 Thông tin chung ................................ ................................ ............................... 7
3.2 v1/credentials/get_certificate ................................ ................................ ........... 9
3.3 v1/signatures/sign ................................ ................................ ......................... 10
3.4 v1/signatures/sign/{tranId}/status ................................ ................................ .. 12
3.5 API webhook nh ận thông tin ký s ố ................................ ................................ ... 13
4 Tích h ợp ký s ố với SmartCA tích h ợp (SmartCA TH) ................................ ................. 14
4.1 Thông tin chung ................................ ................................ ............................. 14
4.2 v1/credentials/get_certificate ................................ ................................ ......... 15
4.3 v2/signatures/sign ................................ ................................ ......................... 16
4.4 v2/signatures/confirm ................................ ................................ .................... 18
5 Sample code m ẫu ................................ ................................ ................................ . 19

Tài liệu tích hợp VNPT SMARTCA

VNPT 5
1 Giới thiệu
1.1 Quy ư ớc sử dụng
Trong tài li ệu này chúng tôi s ử dụng các quy ư ớc sau nh ằm giúp vi ệc trình bày đư ợc
rõ ràng và thu ận tiện hơn trong vi ệc nắm bắt nội dung:  
Quy ư ớc Ý nghĩa Ví dụ
Courier New Đoạn mã “RequestID”: “ 5b483845 -35b6-48c9-
b9a6-3a4024271271 ”
Bold Nội dung c ần nhấn
mạnh …yêu c ầu phương th ức
POST .
code Tham s ố hoặc giá tr ị
tham số, kết quả response_type=code

Các n ội dung c ần lưu ý s ẽ được trình bày v ới định dạng như sau:  
 Nội dung cần lưu ý  
1.2 Giao th ức API  
Phân h ệ Gateway API đư ợc cung c ấp qua giao th ứ HTTPs và yêu c ầu phương th ức
POST .  
Địa chỉ service UAT: https://rmgateway.vnptit.vn /sca/sp769  
Địa chỉ service Production: https://gwsca.vnpt.vn /sca/sp769

Tài liệu tích hợp VNPT SMARTCA

VNPT 6
2 Tài kho ản  
2.1 Tài khoản nhà phát tri ển(3rd Party )
Các đơn v ị có nhu c ầu sử dụng dịch vụ SmartCA s ẽ cần liên h ệ và đăng ký thông tin
doanh nghi ệp, các thành viên v ới ĐHSXKD theo m ẫu mà ĐHSXKD cung c ấp.  
Mỗi một đơn v ị sẽ được cấp cho 1 b ộ thông tin để kết nối với SmartCA API  
Các t hông tin 3rd Party cần cung c ấp

1. Tên h ệ thống (vd: Ứng dụng nộp thu ế ABC)
2. Mô t ả thông tin ứng dụng kết nối (Ứng dụng được phát tri ển bằng
3. Email c ủa quản trị viên - Email nh ận thông tin c ặp kết nối Client_ID và Client
   Secret:  
   Các thông tin 3rd Party nh ận đư ợc. Tạo tài kho ản thành công, thông tin s ẽ gửi về
   email :
4. Client id : Thông tin đ ể đinh danh tài kho ản doanh nghi ệp
5. Client secret : Mã bí m ật để xác th ực thông tin  
   2.2 Tài kho ản ngư ời dùng cu ối
   Thông tin ngư ời dùng c ần cung c ấp để thực hiện tạo tài kho ản dùng th ử SmartCA :
6. Họ tên
7. Số CCCD
8. Email
9. Số điện tho ại
   Người dùng s ẽ nhận đư ợc email và tin nh ắn sau khi t ạo tài kho ản thành công. Người
   dùng th ực hiện kích ho ạt tài kho ản thông qua app VNPT SmartCA

Tài liệu tích hợp VNPT SMARTCA

VNPT 7
3 Tích h ợp ký số với SmartCA

Tham kh ảo hư ớng dẫn sau đ ể sử dụng dịch vụ SmartCA ký s ố trên App c ủa bạn
Bước 1: Khách hàng upload tài li ệu lên và yêu c ầu Ký
Bước 2: App c ủa bạn yêu c ầu khách hàng nhập tài kho ản
Bước 3: Khi khách hàng nhập tài kho ản, app c ủa bạn sẽ tạo giao d ịch ký và
chuy ển tới VNPT SmartCA  
Bước 4: App c ủa bạn gửi yêu c ầu Ký đ ến SmartCA theo API Ký  
Bước 5: Khách hàng c ần xác nh ận qua app SmartCA. Khi khách hàng xác nh ận
qua app thì h ệ thông s ẽ gửi thông tin đ ến server c ủa bạn để thông báo k ết quả
Bước 6: Khách hàng yêu c ầu tải tài li ệu.
Bước 7: D ựa vào tranId đư ợc response tr ả về từ bước 4, App c ủa bạn gửi yêu
cầu tới SmartCA thông qua API get Transaction Info đ ể lấy thông tin  
Bước 8: App c ủa bạn sẽ dựa vào thông tin tr ả về và export ra file đã ký cho
khách hàng  
3.1 Thông tin chung  
Phân h ệ Gateway API đư ợc cung c ấp qua giao th ứ HTTPs và yêu c ầu phương th ức
POST .

Tài liệu tích hợp VNPT SMARTCA

VNPT 8
Địa chỉ service UAT: https://rmgateway.vnptit.vn/sca/sp769  
Địa chỉ service Production: https://gwsca.vnpt.vn/sca/sp769  
Mã lỗi thư ờng gặp
STT Mã Tên Ý nghĩa

1  
 200 SUCCESS Success

2  
 400 BAD_REQUEST Bad request.  
(Http response code)

3  
 401 SP_CREDENTIAL_INVALI
D Thông tin tài kho ản sp,
người dùng không h ợp lệ  
(Chi ti ết mô t ả trong
trường message)

4  
 403 CREDENTIAL_STATUS_IN
VALID Thông tin ch ứng thư
không h ợp lệ (Chi ti ết mô
tả trong trư ờng
message)

5  
 500 SERVAR_INTERNAL_ERR
OR Có lỗi trong quá trình x ử
lý yêu c ầu  
(Chi ti ết mô t ả trong
trường message)  
• Response m ẫu:  
{  
 "status_code ": 200,  
 "message": " SUCCESS",  
 "data": {  
 "transaction_id": "SP_CA_123456",  
 "tran_code": "acd9be84 -60e7-4645-83ab-fb7079b71626"  
 }  
}

Tài liệu tích hợp VNPT SMARTCA

VNPT 9
3.2 v1/credentials/get_certificate  
• Mục đích: L ấy thông tin ch ứng thư s ố thuê bao  
• HTTP Method: POST  
• Request Content -type: application/json  
• Response Content -type: application/json  
• Tham s ố:
Key Type Description  
sp_id String (Required) Tên tài kho ản của SP do CA
cung c ấp  
sp_password String (Required) Mật khẩu do CA cung c ấp cho
SP  
user_id  
 String (Required ) Số CCCD/CMND/H ộ chiếu/Mã s ố
thuế của cá nhân/t ổ chức là thuê bao c ủa CA

serial_number  
 String (Optional ) Số serial c ủa chứng thư s ố cần
lấy thông tin (trong trư ờng hợp thuê bao có
nhiều chứng thư s ố)

transaction_id  
 String (Required ) Mã giao d ịch kh ởi tạo bởi SP

• Request m ẫu:
curl  
--location  
--request POST 'https://rmgateway.vnptit.vn/sca/sp769/v1/credentials/get_certificate'  
--header 'Content -Type: application/json'  
--data-raw '{  
"sp_id": "4184 -637127995547330633.apps.signserviceapi.com",  
"sp_password": "NGNhMzdmOGE -OGM2Mi00MTg0",  
"user_id": " 162952530 ",  
"serial_number": "",  
"
• Response m ẫu:
{
"status_code": 200,  
 "message": "Success",  
 "data": {  
 "user_certificates": [  
 {
"service_type": "SMARTCA",  
 "service_name": "SMARTCA PERSONAL PRO",  
 "cert_id": "fcfffddf -2bed-4dda-8276-d00b4c3df6c9",  
 "cert_status": "Đang ho ạt động",
"serial_number": "54010101493c47d39f8a84b30ed55191",  
 "cert_subject": "C=VN,ST=HÀ N ỘI,L=Quận,CN=Ngô Quang Đ ạt test
SmartCA,UID=CMND:162952530",  
 "cert_valid_from": "2023 -07-18T09:12:00Z",  
 "cert_valid_to": "2026 -07-18T21:12:00Z",

Tài liệu tích hợp VNPT SMARTCA

VNPT 10
"cert_data": "MIIFQjCCBCqgAwIBAg...",  
 "chain_data": {  
 "ca_cert": "MIIGNDCCBBygAwI...",  
 "root_cert": "MIIG/DCCBOSgAw..."  
 },
"transaction_id": "SP_CA_09940"  
 },
{
"service_type": "ESEAL",  
 "service_name": "ESEAL",  
 "cert_id": "45bbe953 -2b8d-4a5f-b31a-e766bca5ebc2",  
 "cert_status": "Đang ho ạt động",
"serial_number": "540101013e3772189f6b3981df73bf0a",  
 "cert_subject": "CN=Ngô Quang Đ ạt Test,UID=CCCD:162952530",  
 "cert_valid_from": "2024 -01-27T00:58:00Z",  
 "cert_valid_to": "2025 -01-27T00:58:00Z",  
 "cert_data": "MIIFEDC...",  
 "chain_data": {  
 "ca_cert": "MIIDrTCCA...",  
 "root_cert": "MIIGMzCCBB..."  
 },
"transaction_id": "SP_CA_09940"  
 },
{
"service_type": "ESEAL",  
 "service_name": "ESEAL",  
 "cert_id": "0e2a827b -ef84-49f4-8be2-d80094158350",  
 "cert_status": "Đang ho ạt động",
"serial_number": "54010101e7572ce0f9ff8c363ca1cfb8",  
 "cert_subject": "CN=Ngô Quang Đ ạt Test,UID=CCCD:162952530",  
 "cert_valid_from": "2024 -01-27T00:57:00Z",  
 "cert_valid_to": "2025 -01-27T00:57:00Z",  
 "cert_data": "MIIFEDCCA/igAwIBAgIQVA...",  
 "chain_data": {  
 "ca_cert": "MIIDrTCCApWgAwIB...",  
 "root_cert": "MIIGMzCCBBugAwIB..."  
 },
"transaction_id": "SP_CA_09940"  
 }
]
}
} }

3.3 v1/signatures/sign

• Mục đích: G ửi yêu c ầu ký s ố của thuê bao t ới CA  
• Request Content -type: application/json  
• Response Content -type: application/json  
• Tham s ố:  
Key Type Description  
sp_id String (Required) Tên tài kho ản của SP do CA cung c ấp  
sp_password String (Required) Mật khẩu do CA cung c ấp cho SP  
user_id String (Required) Số CCCD/CMND/H ộ chiếu/Mã s ố thuế của cá
nhân/t ổ chức là thuê bao c ủa CA

Tài liệu tích hợp VNPT SMARTCA

VNPT 11
transaction_desc String (Optional) Nội dung mô t ả giao d ịch

sign_files

data_to_be_signed  
 String (Required) Chuỗi biểu diễn của tài li ệu đư ợc yêu cầu ký
số (Base64 string v ới file, hex v ới hash)  
doc_id

String (Required) Mã tài li ệu yêu c ầu ký s ố  
(Mã này c ần đư ợc hiển thị đồng th ời tại giao di ện của SP và
tại giao di ện ứng dụng xác nh ận của CA khi ngư ời dùng th ực
hiện xác nh ận yêu c ầu ký s ố)  
file_type  
 String (Required) Loại file: xml/json/word/pdf/…  
sign_type  
 String (Required) Loại ký s ố: hash/file  
serial_number String (Optional) Số serial c ủa chứng thư s ố cần lấy thông tin
(trong trư ờng hợp thuê bao có nhi ều chứng thư s ố)  
time_stamp String (Optional) Thời gian ngư ời dùng g ửi yêu c ầu ký s ố. Định
dạng YYYYMMddHHmmSS  
transaction_id String (Required) Mã giao d ịch kh ởi tạo bởi SP- yêu c ầu là duy
nhất

• Request m ẫu
curl --location --request POST
'https://rmgateway.vnptit.vn/sca/sp769/v1/signatures/sign' \ --header 'Content -Type:
application/json' \ --data-raw '{
"sp_password": "NGNhMzdmOGE -OGM2Mi00MTg0",  
 "user_id": "0131930813216",  
 "transaction_id": "SP_CA_123456",  
 "transaction_desc": "VTBRD253D19",  
 "serial_number": "52341c3f9dcs2371",  
 "sign_files": [
{
"file_type": "pdf",
"data_to_be_signed": "
3cab0a7c77da32d278f4e85053176d847064cc84b0f1528aa96438a3edf92060 ",
"doc_id": "30c -7401-2562",
"sign_type": "hash"
},
{
"file_type": "xml",
"data_to_be_signed": "
3cab0a7c77da32d278f4e85053176d847064cc84b0f1528aa96438a3edf92060 ",
"doc_id": "29a -7749-1325",
"sign_type": "hash"
}
],
"sp_id": "4184 -637127995547330633.apps.signserviceapi.com",  
 "time_stamp": "20220316063000Z"  
}'

• Response m ẫu:  
{  
 "status_code": 200,

Tài liệu tích hợp VNPT SMARTCA

VNPT 12
"message": " sig_wait_for_user_confirm",  
 "data": {  
 "transaction_id": "SP_CA_123456",  
 "tran_code": "acd9be84 -60e7-4645-83ab-fb7079b71626"  
 }  
}

Sau khi nhận được yêu cầu ký số, CA sẽ gửi thông báo tới ứng dụng
của thuê bao để yêu cầu xác nhận giao dịch, sau khi thuê bao xác
nhận thành công  
Có thể ký theo lô bằng cách add thêm item vào sign_files  
 Hiện tại SmartCA chỉ hỗ trợ giao dịch ký hash

3.4 v1/signatures/sign/{tranId}/status  
• Mục đích: SP ch ủ động ki ểm tra tr ạng thái giao d ịch, không ph ụ thuộc vào  
webhook thông báo t ừ CA  
• Method: POST  
• Request Content -type: application/json  
• Response Content -type: application/json  
• Tham s ố: {tranId} mã id c ủa của giao d ịch ở API 3.3 trả về
• Response m ẫu:
{  
 "status_code": 200,  
 "message": "SUCCESS",  
 "data": {  
 "transaction_id": "c7eabdae -740e-4845-9bcd-dc495562d0bf",  
 "signatures": [
{
"doc_id": "30c -7401-2562",
"signature_value": "A7WttpP9/+8hUpZI/…",
"timestamp_signature": null
},
{
"doc_id": "29a -7749-1325",
"signature_value": "A7WttpP9/+8hUpZI/…",
"timestamp_signature": null
}
]  
 }  
}

Tài liệu tích hợp VNPT SMARTCA

VNPT 13

3.5 API webhook nh ận thông tin ký s ố
• Mục đích: CA g ửi thông tin giao d ịch tới SP sau khi ký s ố hoàn t ất
• Request Content -type: application/ json  
• Response Content -type: application/ json  
• Tham s ố:  
Key Type Description  
sp_id String (Required) Tên tài kho ản của SP do CA cung c ấp  
status_code Int (Required) Mã thông báo k ết quả  
message String (Required) Thông đi ệp thông báo  
transaction_id String (Optional) Mã giao d ịch kh ởi tạo bởi SP

signed_files
doc_id

String (Required) Mã tài li ệu yêu c ầu ký s ố  
(Mã này c ần đư ợc hiển thị đồng th ời tại giao di ện của SP và
tại giao di ện ứng dụng xác nh ận của CA khi ngư ời dùng th ực
hiện xác nh ận yêu c ầu ký s ố)  
signature_value

String (Optional) Chữ ký tương ứng với doc_id
timestamp_signatu
re
String (Optional )Chữ ký của CA lên d ấu thời gian c ủa giao d ịch
ký số

Tài liệu tích hợp VNPT SMARTCA

VNPT 14
4 Tích h ợp ký s ố với SmartCA tích h ợp (SmartCA TH)

SmartCATH là 1 lo ại tài kho ản của SmartCA, lo ại tài kho ản này đ ầy đủ các tính năng
của SmartCA bình thư ờng, có th ể gửi tất cả các lu ồng API c ủa mục 3 và có thêm 1
tính năng n ữa đấy là có th ể ký mà không c ần xác nh ận trên APP đi ện tho ại nếu như
người dùng cung c ấp các thông tin c ần thiết để thực hiện luồng ký t ự động này

Tham kh ảo hư ớng dẫn sau đ ể sử dụng dịch vụ SmartCA ký s ố trên App c ủa bạn
Bước 1: Khách hàng upload tài li ệu lên và yêu c ầu Ký
Bước 2: App c ủa bạn yêu c ầu khách hàng đăng nh ập vào SmartCA đ ể tiến hành
ký (gồm 2 thông tin: tài kho ản, mật khẩu), và TOTP ho ặc OTP  
Bước 3: Để tạo giao d ịch, App c ủa bạn cần tạo hash c ủa file c ần ký, và OTP đ ối
với trường hợp Ngư ời dùng cung c ấp mã TOTP.  
Bước 4: SmartCA TH s ẽ tạo giao d ịch, tạo dữ liệu của giao d ịch. App c ủa bạn
cần chuy ển tiếp dữ liệu này t ới API xác nh ận giao d ịch (signatures/confirm)  
Bước 5: SmartCA TH thực hiện ký và tr ả về chữ ký
Bước 6: App c ủa bạn nhận đư ợc chữ ký, thêm ch ữ ký vào file thu đư ợc file hoàn
chỉnh

4.1 Thông tin chung  
Xem ph ần thông tin chung m ục tích h ợp ký s ố với SmartCA

Tài liệu tích hợp VNPT SMARTCA

VNPT 15
4.2 v1/credentials/get_certificate  
• Mục đích: L ấy thông tin ch ứng thư s ố thuê bao  
• HTTP Method: POST  
• Request Content -type: application/json  
• Response Content -type: application/json  
• Tham s ố:
Key Type Description  
sp_id String (Required) Tên tài kho ản của SP do CA
cung c ấp  
sp_password String (Required) Mật khẩu do CA cung c ấp cho
SP  
user_id  
 String (Required) Số CCCD/CMND/H ộ chiếu/Mã s ố
thuế của cá nhân/t ổ chức là thuê bao c ủa CA

serial_number  
 String (Optional) Số serial c ủa chứng thư s ố cần lấy
thông tin (trong trư ờng hợp thuê bao có nhi ều
chứng thư s ố)

transaction_id  
 String (Required) Mã giao d ịch kh ởi tạo bởi SP

• Request m ẫu:
curl  
--location  
--request POST 'https://rmgateway.vnptit.vn/sca/sp769/v1/credentials/get_certificate'  
--header 'Content -Type: application/json'  
--data-raw '{  
"sp_id": "4184 -637127995547330633.apps.signserviceapi.com",  
"sp_password": "NGNhMzdmOGE -OGM2Mi00MTg0",  
"user_id": "0131930813216",  
"serial_number": "",  
"
• Response m ẫu:
{  
 "status_code": 200,  
 "message": "Success",  
 "data": {  
 "user_certificates": [{
"cert_id": "047db43a -4038-471f-9843-cc52e0b5a194",
"cert_data": "MIIFfjCCBGagAwIBAg...",
"chain_data": {
"ca_cert": "MIIDqTCCApGgAwIBAg...",
"root_cert": null
},
"serial_number": "54010101ed6648476eec44c6354e93a5",
"transaction_id": "SP_CA_09940"
}]  
}

Tài liệu tích hợp VNPT SMARTCA

VNPT 16
}

4.3 v2/signatures/sign

• Mô t ả: Ngư ời dùng cu ối ký s ố thông qua ứng dụng bên th ứ ba (3 rd party) c ần
xác th ực bằng Smart OTP. Ngư ời dùng cu ối có th ể nhập OTP cho t ừng giao
dịch ho ặc ủy quy ền cho 3 rd Party th ực hiện tạo mã OTP.  
o Người dùng nh ập OTP t ừng giao d ịch: nếu kích ho ạt qua app VNPT
SmartCA, ngư ời dùng s ử dụng OTP đư ợc sinh trên app. N ếu kích ho ạt
qua website, ngư ời dùng có th ể quét mã QR code b ằng ứng dụng
VNPT SmartCA (ho ặc Google Authenticator, Microsoft Authenticator,
…) để sinh mã OTP.  
o Người dùng ủy quy ền cho 3 rd Party sinh OTP : Ngư ời dùng c ấu hình key
TOTP trên ứng dụng 3 rd Party. Khi phát sinh giao d ịch 3 rd Party t ạo mã
OTP t ừ key c ủa ngư ời dùng cung c ấp, hiển thị mã OTP cho phép ngư ời
dùng so kh ớp và s ử dụng OTP trong API.  
• Mục đích: G ửi yêu c ầu ký s ố của thuê bao t ới CA (s ử dụng cho thuê bao s ử
dụng gói tích h ợp)  
• Request Content -type: application/json  
• Response Content -type: application/json  
• Tham s ố:  
Key Type Description  
sp_id String (Required) Tên tài kho ản của
SP do CA cung c ấp  
sp_password String (Required) Mật khẩu do CA
cung c ấp cho SP  
user_id String (Required) Số
CCCD/CMND/H ộ chiếu/Mã s ố
thuế của cá nhân/t ổ chức là thuê
bao c ủa CA  
password String (Required) Mật khẩu đăng
nhập của thuê bao  
otp String (Required) Mã OTP c ủa thuê
bao  
(Do thuê bao t ự quản lý trên các
ứng dụng qu ản lý mã OTP ho ặc ủy
quyền cho ứng dụng tích h ợp quản

Tài liệu tích hợp VNPT SMARTCA

VNPT 17
lý và sinh t ự động khi ký s ố bằng
mã TOTP )  
transaction_desc String (Optional) Nội dung mô t ả
giao d ịch

sign_files  
 data_to_be_signed  
 String (Required) Chuỗi biểu diễn
của tài li ệu đư ợc yêu c ầu ký s ố
(Base64 string v ới file, hex v ới
hash)  
doc_id
String (Required) Mã tài li ệu yêu
cầu ký s ố  
(Mã này c ần đư ợc hiển thị đồng
thời tại giao di ện của SP và t ại
giao di ện ứng dụng xác nh ận của
CA khi ngư ời dùng th ực hiện xác
nhận yêu c ầu ký s ố)

file_type  
 String (Required) Loại file:
xml/json/word/pdf/…  
sign_type  
 String (Required) Loại ký s ố:
hash/file  
serial_number String (Required ) Số serial c ủa
chứng thư s ố cần để ký (L ấy từ
API m ục 4.2)
time_stamp String (Optional) Thời gian ngư ời
dùng g ửi yêu c ầu ký s ố. Định dạng
YYYYMMddHHmmSS  
transaction_id String (Required) Mã giao d ịch kh ởi
tạo bởi SP, yêu c ầu là duy nh ất  
• Request m ẫu:
curl --location --request POST
'https://rmgateway.vnptit.vn/sca/sp769/v2/signatures/sign' \ --header 'Content -Type:
application/json' \ --data-raw '{
"sp_password": "MjkyOTNkYzY -NjAzNC00MTk5",  
 "user_id": "112292",  
 "transaction_id": "9eecc3e3 -9e1b-41de-9b39-48e7bcecdebe",  
 "password": "123456a@A",  
 "serial_number": "54010101aad15185e5d334900b526deb",  
 "sign_files": [
{
"file_type": "pdf",
"data_to_be_signed":
"17001dcce9fe19e30cba5219f86ad05fd6c802338078521af634dab92eef96d7",
"doc_id": "30c -7401-2562",
"sign_type": "hash"
}
],
"otp": "249560",  
 "sp_id": "4359 -637867525374672312.apps.smartcaapi.com"  
}'
• Response m ẫu:
{  
 "status_code": 200,

Tài liệu tích hợp VNPT SMARTCA

VNPT 18
"message": "sig_wait_for_user_confirm",  
 "data": {  
 "transaction_id": "67975bcc -5ee7-4a24-ab29-dd9f3c8fe32a",  
 "tran_code": "b40d5ec4 -513c-420a-b4e8-cc413eac308c",  
 "sad": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...",  
 "expired_in": 299  
 }  
}

Có thể ký theo lô bằng cách add thêm item vào sign_files  
Hiện tại SmartCA chỉ hỗ trợ giao dịch ký hash

4.4 v2/signatures/confirm

• Mục đích: Xác nh ận giao d ịch ký s ố (sử dụng cho thuê bao s ử dụng gói tích
hợp)  
• Request Content -type: application/json  
• Response Content -type: application/json  
• Tham s ố:  
Key Type Description  
sp_id String (Required) Tên tài kho ản của
SP do CA cung c ấp  
sp_password String (Required) Mật khẩu do CA
cung cấp cho SP  
user_id String (Required) Số
CCCD/CMND/H ộ chiếu/Mã s ố
thuế của cá nhân/t ổ chức là thuê
bao c ủa CA  
password String (Required) Mật khẩu đăng
nhập của thuê bao  
sad String (Required) Dữ liệu kích ho ạt
ký số được trả về ở api 4.5  
transaction_id String (Required) Mã giao d ịch kh ởi
tạo bởi SP  
• Request m ẫu:  
curl --location --request POST
'https://rmgateway.vnptit.vn/sca/sp769/v2/signatures/confirm' \ --header 'Content -
Type: application/json' --data-raw '{
"sp_password": "MjkyOTNkYzY -NjAzNC00MTk5",  
 "user_id": "112292",  
 "transaction_id": "a71bf8ad -71ad-4823-b586-33c8698b768e",  
 "password": "123456a@A",

Tài liệu tích hợp VNPT SMARTCA

VNPT 19
"sp_id": "4359 -637867525374672312.apps.smartcaapi.com",  
 "sad": " eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9... "
}'
Response m ẫu:
{  
 "status_code": 200,  
 "message": "Success",  
 "data": {  
 "transaction_id": "a71bf8ad -71ad-4823-b586-33c8698b768e",  
 "expired_in": 299,  
 "signatures": [
{
"doc_id": "30c -7401-2562",
"signature_value ": "ZLebEc4JFwgCT2l13feWFH6…"
"timestamp_signature": null
}
]  
}

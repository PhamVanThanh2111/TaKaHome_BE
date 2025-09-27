export enum PaymentPurpose {
  WALLET_TOPUP = 'WALLET_TOPUP', // Nạp tiền vào ví
  TENANT_ESCROW_DEPOSIT = 'TENANT_ESCROW_DEPOSIT', // người thuê nộp cọc
  LANDLORD_ESCROW_DEPOSIT = 'LANDLORD_ESCROW_DEPOSIT', // chủ nhà nộp cọc
  FIRST_MONTH_RENT = 'FIRST_MONTH_RENT', // Tiền thuê tháng đầu
  MONTHLY_RENT = 'MONTHLY_RENT', // Tiền thuê hàng tháng
}

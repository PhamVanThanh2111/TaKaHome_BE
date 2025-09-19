export enum PaymentPurpose {
  WALLET_TOPUP = 'WALLET_TOPUP', // Nạp tiền vào ví
  ESCROW_DEPOSIT = 'ESCROW_DEPOSIT', // người thuê nộp cọc
  OWNER_ESCROW_DEPOSIT = 'OWNER_ESCROW_DEPOSIT', // chủ nhà nộp cọc
  FIRST_MONTH_RENT = 'FIRST_MONTH_RENT', // Tiền thuê tháng đầu
  MONTHLY_RENT = 'MONTHLY_RENT', // Tiền thuê hàng tháng
}

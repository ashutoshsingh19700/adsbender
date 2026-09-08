import { IsString, MaxLength } from 'class-validator';

// The order id PayPal Checkout's onApprove handler hands back to the
// browser. That id alone is enough to identify the order server-side - the
// actual capture call goes from our backend straight to PayPal's API (see
// PayPalService.captureOrder), so unlike Razorpay's client-relayed signature
// there is nothing here for the browser to forge.
export class CapturePaymentDto {
  @IsString()
  @MaxLength(64)
  paypalOrderId: string;
}

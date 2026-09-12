import { IsString, MaxLength } from 'class-validator';

// The three fields Razorpay Checkout's success handler hands back to the
// browser. Together with the key secret (server-side only) these let
// RazorpayService.verifyPaymentSignature prove the payment is genuine - none
// of these three values alone is enough for the browser to forge a "paid"
// result.
export class VerifyRazorpayPaymentDto {
  @IsString()
  @MaxLength(64)
  razorpayOrderId: string;

  @IsString()
  @MaxLength(64)
  razorpayPaymentId: string;

  @IsString()
  @MaxLength(256)
  razorpaySignature: string;
}

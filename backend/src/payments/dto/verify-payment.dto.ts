import { IsString, MaxLength } from 'class-validator';

// Fields Razorpay Checkout's success handler hands back to the browser -
// see RazorpayService.verifyPaymentSignature for how these are authenticated
// server-side (the browser cannot be trusted to say "this payment succeeded"
// on its own).
export class VerifyPaymentDto {
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

import { Test, TestingModule } from "@nestjs/testing";
import { HttpModule } from "@nestjs/axios";
import { ConfigModule } from "@nestjs/config";
import { SmartCAService } from "./smartca.service";

describe("SmartCAService", () => {
  let service: SmartCAService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        HttpModule,
        ConfigModule.forRoot({
          isGlobal: true,
        }),
      ],
      providers: [SmartCAService],
    }).compile();

    service = module.get<SmartCAService>(SmartCAService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should validate config correctly", () => {
    const validConfig = {
      sp_id: "test_sp_id",
      sp_password: "test_sp_password", 
      user_id: "123456789",
    };

    const invalidConfig = {
      sp_id: "",
      sp_password: "test_sp_password",
      user_id: "123456789",
    };

    expect(service.validateConfig(validConfig)).toBe(true);
    expect(service.validateConfig(invalidConfig)).toBe(false);
  });

  it("should generate transaction ID", () => {
    const transactionId = service.generateTransactionId();
    expect(transactionId).toBeDefined();
    expect(typeof transactionId).toBe("string");
    expect(transactionId.length).toBeGreaterThan(0);
  });

  it("should create hash from buffer", () => {
    const testBuffer = Buffer.from("test content", "utf8");
    const hash = service.createHash(testBuffer);
    
    expect(hash).toBeDefined();
    expect(typeof hash).toBe("string");
    expect(hash.length).toBe(64); // SHA256 hash length in hex
  });
});

import type mongoose from "mongoose";
import { Types } from "mongoose";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  FUNDRAISING_CAMPAIGN_NOT_FOUND_ERROR,
  FUND_NOT_FOUND_ERROR,
  USER_NOT_AUTHORIZED_ERROR,
  USER_NOT_FOUND_ERROR,
} from "../../../src/constants";
import {
  AppUserProfile,
  Fund,
  FundraisingCampaign,
  type InterfaceFundraisingCampaign,
} from "../../../src/models";
import { removeFundraisingCampaign } from "../../../src/resolvers/Mutation/removeFundraisingCampaign";
import type { TestFundType } from "../../helpers/Fund";
import { createTestFundraisingCampaign } from "../../helpers/FundraisingCampaign";
import { connect, disconnect } from "../../helpers/db";
import { createTestUser } from "../../helpers/user";
import type { TestUserType } from "../../helpers/userAndOrg";
import type { TestPledgeType } from "../../helpers/FundraisingCampaignPledge";
import { createTestFundraisingCampaignPledge } from "../../helpers/FundraisingCampaignPledge";

let MONGOOSE_INSTANCE: typeof mongoose;
let testUser: TestUserType;
let testCampaign: InterfaceFundraisingCampaign;
let testFund: TestFundType;
let testPledge: TestPledgeType;

beforeAll(async () => {
  MONGOOSE_INSTANCE = await connect();
  const { requestContext } = await import("../../../src/libraries");

  vi.spyOn(requestContext, "translate").mockImplementation(
    (message) => message,
  );

  const temp = await createTestFundraisingCampaignPledge();
  testUser = temp[0];
  testFund = temp[2];
  testPledge = temp[4];
  testCampaign = temp[3];
});

afterAll(async () => {
  await disconnect(MONGOOSE_INSTANCE);
});

describe("resolvers->Mutation->removeFundraisingCampaign", () => {
  it("throws an error if no user exists with _id===context.userId", async () => {
    try {
      const args = {
        id: testFund?._id,
      };
      const context = {
        userId: new Types.ObjectId().toString(),
      };
      await removeFundraisingCampaign?.({}, args, context);
    } catch (error: unknown) {
      expect((error as Error).message).toEqual(USER_NOT_FOUND_ERROR.MESSAGE);
    }
  });

  it("throws an error if no fund campaign exists with _id===args.id", async () => {
    try {
      const args = {
        id: new Types.ObjectId().toString(),
      };
      const context = {
        userId: testUser?._id,
      };
      await removeFundraisingCampaign?.({}, args, context);
    } catch (error: unknown) {
      expect((error as Error).message).toEqual(
        FUNDRAISING_CAMPAIGN_NOT_FOUND_ERROR.MESSAGE,
      );
    }
  });

  it("throws an error if no fund exists with _id===campaign.fundId", async () => {
    try {
      const campaign = await createTestFundraisingCampaign(
        new Types.ObjectId().toString(),
        testFund?.organizationId,
      );
      const args = {
        id: campaign?._id.toString() || "",
      };
      const context = {
        userId: testUser?._id,
      };
      await removeFundraisingCampaign?.({}, args, context);
    } catch (error: unknown) {
      expect((error as Error).message).toEqual(FUND_NOT_FOUND_ERROR.MESSAGE);
    }
  });

  it("throws an error if the user is not admin of the organization or superadmin", async () => {
    try {
      const args = {
        id: testCampaign?._id.toString(),
      };
      const randomUser = await createTestUser();
      const context = {
        userId: randomUser?._id,
      };
      await removeFundraisingCampaign?.({}, args, context);
    } catch (error: unknown) {
      expect((error as Error).message).toEqual(
        USER_NOT_AUTHORIZED_ERROR.MESSAGE,
      );
    }
  });

  it("deletes the fundraising campaign", async () => {
    await AppUserProfile.findOneAndUpdate(
      { userId: testUser?._id },
      {
        $set: {
          adminFor: [testFund?.organizationId.toString()],
          isSuperAdmin: true,
        },
      },
      { new: true, upsert: true },
    );
    const args = { id: testCampaign._id.toString() };
    const context = { userId: testUser?._id.toString() };

    await removeFundraisingCampaign?.({}, args, context);
    const deletedCampaign = await FundraisingCampaign.findById(args.id);
    expect(deletedCampaign).toBeNull();
  });

  it("removes the campaign from the fund", async () => {
    await AppUserProfile.findOneAndUpdate(
      { userId: testUser?._id },
      {
        $set: {
          adminFor: [testFund?.organizationId.toString()],
          isSuperAdmin: true,
        },
      },
      { new: true, upsert: true },
    );
    const newCampaign = await createTestFundraisingCampaign(
      testFund?._id,
      testFund?.organizationId,
    ); // Ensuring a fresh campaign for this test
    const args = { id: newCampaign._id.toString() };
    const context = { userId: testUser?._id.toString() };

    await removeFundraisingCampaign?.({}, args, context);
    const fundAfterDeletion = await Fund.findById(testFund?._id);
    expect(fundAfterDeletion?.campaigns).not.toContainEqual(
      new Types.ObjectId(args.id),
    );
  });
  it("throws an error if the user does not have appUserProfile", async () => {
    await AppUserProfile.deleteOne({ userId: testUser?._id });
    testCampaign = await createTestFundraisingCampaign(
      testFund?._id,
      testFund?.organizationId,
    );
    const args = {
      id: testCampaign?._id.toString() || "",
    };
    const context = {
      userId: testUser?._id.toString() || "",
    };

    try {
      await removeFundraisingCampaign?.({}, args, context);
    } catch (error: unknown) {
      expect((error as Error).message).toEqual(
        USER_NOT_AUTHORIZED_ERROR.MESSAGE,
      );
    }
  });

  it("Check if AppUserProfile is updated after removing the campaign", async () => {
    await AppUserProfile.findOneAndUpdate(
      { userId: testUser?._id },
      {
        $set: {
          adminFor: [testFund?.organizationId.toString()],
          isSuperAdmin: true,
        },
      },
      { new: true, upsert: true },
    );
    const args = { id: testCampaign._id.toString() };
    const context = { userId: testUser?._id.toString() };

    await removeFundraisingCampaign?.({}, args, context);
    const deletedCampaign = await FundraisingCampaign.findById(args.id);
    expect(deletedCampaign).toBeNull();
    const updatedUserProfile = await AppUserProfile.findOne({
      userId: testUser?._id,
    });

    expect(updatedUserProfile?.campaigns).not.toContainEqual(
      new Types.ObjectId(args.id),
    );

    expect(updatedUserProfile?.pledges).not.toContainEqual(
      new Types.ObjectId(testPledge?._id),
    );
  });
});

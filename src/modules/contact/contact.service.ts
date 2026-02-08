import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Contact, ContactDocument, ContactStatus } from './schemas/contact.schema';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Role } from '../../common/decorators/roles.decorator';

@Injectable()
export class ContactService {
  constructor(
    @InjectModel(Contact.name) private contactModel: Model<ContactDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  async create(
    createContactDto: CreateContactDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const { name, email, phone, subject, message } = createContactDto;

    // Check for duplicate submission (same email + subject within last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentSubmission = await this.contactModel.findOne({
      email: email.toLowerCase(),
      subject: subject.trim(),
      createdAt: { $gte: fiveMinutesAgo },
    });

    if (recentSubmission) {
      throw new BadRequestException(
        'Duplicate submission detected. Please wait a few minutes before submitting again.',
      );
    }

    // Create contact submission
    const contact = new this.contactModel({
      name: name.trim(),
      email: email.toLowerCase(),
      phone: phone.trim(),
      subject: subject.trim(),
      message: message.trim(),
      status: ContactStatus.Pending,
      ipAddress,
      userAgent,
    });

    try {
      const savedContact = await contact.save();

      // Send email notifications (non-blocking - don't fail if email fails)
      this.sendEmailNotifications(savedContact).catch((error) => {
        console.error('Failed to send contact form email notifications:', error);
        // Don't throw - email failure shouldn't prevent form submission
      });

      return {
        id: savedContact._id.toString(),
        name: savedContact.name,
        email: savedContact.email,
        phone: savedContact.phone,
        subject: savedContact.subject,
        message: savedContact.message,
        status: savedContact.status,
        createdAt: (savedContact as any).createdAt || new Date(),
      };
    } catch (error) {
      console.error('Contact form submission error:', error);
      throw new InternalServerErrorException(
        'Failed to submit contact form. Please try again later.',
      );
    }
  }

  private async sendEmailNotifications(contact: ContactDocument) {
    const emailFrom = this.configService.get<string>('EMAIL_FROM') || 'noreply@ecommerce.com';

    // Get all admin users from database
    try {
      const adminUsers = await this.userModel
        .find({ role: Role.Admin, isActive: true })
        .select('email')
        .lean();

      if (adminUsers.length === 0) {
        console.warn(`No admin users found in database. Contact form notification not sent for contact ${contact._id}. Please ensure admin users exist with role 'admin'.`);
        return;
      }

      // Send notification to all admin users
      for (const admin of adminUsers) {
        if (admin.email) {
          try {
            await this.emailService.sendContactFormNotificationToAdmin(
              admin.email,
              {
                name: contact.name,
                email: contact.email,
                phone: contact.phone,
                subject: contact.subject,
                message: contact.message,
                contactId: contact._id.toString(),
                createdAt: (contact as any).createdAt || new Date(),
              },
            );
            console.log(`Contact form notification sent to admin ${admin.email} for contact ${contact._id}`);
          } catch (error) {
            console.error(`Failed to send admin notification email to ${admin.email}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch admin users for contact form notification:', error);
    }

    // Send auto-reply to user
    try {
      await this.emailService.sendContactFormAutoReply(contact.email, {
        name: contact.name,
        subject: contact.subject,
      });
    } catch (error) {
      console.error('Failed to send auto-reply email:', error);
    }
  }

  // Admin methods
  async findAll(
    page = 1,
    limit = 10,
    status?: ContactStatus,
    search?: string,
  ) {
    const actualLimit = Math.min(limit, 100); // Max 100 per page
    const skip = (page - 1) * actualLimit;
    const query: any = {};

    // Status filter
    if (status) {
      query.status = status;
    }

    // Search filter (name, email, or subject)
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      this.contactModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(actualLimit)
        .lean(),
      this.contactModel.countDocuments(query),
    ]);

    return {
      items: contacts.map((contact) => ({
        ...contact,
        _id: contact._id.toString(),
      })),
      meta: {
        page,
        limit: actualLimit,
        total,
        totalPages: Math.ceil(total / actualLimit),
      },
    };
  }

  async findOne(id: string) {
    const contact = await this.contactModel.findById(id).lean();
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }
    return {
      ...contact,
      _id: contact._id.toString(),
    };
  }

  async update(id: string, updateContactDto: UpdateContactDto, adminId?: string) {
    const contact = await this.contactModel.findById(id);
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const { status, notes } = updateContactDto;
    const previousStatus = contact.status;

    // Update status
    if (status !== undefined) {
      contact.status = status;

      // If changing to replied, set repliedAt and repliedBy
      if (status === ContactStatus.Replied && previousStatus !== ContactStatus.Replied) {
        contact.repliedAt = new Date();
        if (adminId) {
          contact.repliedBy = new Types.ObjectId(adminId);
        }
      }
    }

    // Update notes
    if (notes !== undefined) {
      contact.notes = notes.trim() || undefined;
    }

    // Update timestamp
    contact.updatedAt = new Date() as any;

    const updatedContact = await contact.save();

    return {
      ...updatedContact.toObject(),
      _id: updatedContact._id.toString(),
    };
  }

  async delete(id: string) {
    const contact = await this.contactModel.findByIdAndDelete(id);
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    return { message: 'Contact deleted successfully' };
  }
}


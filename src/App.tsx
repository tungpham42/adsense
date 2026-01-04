import React, { useState, useEffect } from "react";
import {
  GoogleOAuthProvider,
  useGoogleLogin,
  useGoogleOneTapLogin,
  googleLogout,
} from "@react-oauth/google";
import {
  Button,
  Layout,
  Table,
  Card,
  Typography,
  Spin,
  message,
  Avatar,
  Space,
  Select,
  ConfigProvider,
  Tag,
  Statistic,
  Row,
  Col,
} from "antd";
import {
  GoogleOutlined,
  RobotOutlined,
  DollarCircleOutlined,
  ThunderboltFilled,
  GlobalOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import "./App.css";

const { Header, Content } = Layout;
const { Title, Text, Paragraph } = Typography;

// --- TYPES ---
interface UserProfile {
  name: string;
  email: string;
  picture: string;
}

interface AdSenseAccount {
  name: string; // ID (e.g., accounts/pub-xxx)
  displayName: string; // Readable name
}

// --- THEME ---
const themeConfig = {
  token: {
    fontFamily: "'Work Sans', sans-serif",
    colorPrimary: "#1677ff",
    borderRadius: 8,
  },
};

const App = () => {
  // --- STATE (With LocalStorage Persistence) ---
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem("adsense_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [tokens, setTokens] = useState<any>(() => {
    const saved = localStorage.getItem("adsense_tokens");
    return saved ? JSON.parse(saved) : null;
  });

  const [accounts, setAccounts] = useState<AdSenseAccount[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // --- PERSISTENCE ---
  useEffect(() => {
    if (user) localStorage.setItem("adsense_user", JSON.stringify(user));
    else localStorage.removeItem("adsense_user");
  }, [user]);

  useEffect(() => {
    if (tokens) localStorage.setItem("adsense_tokens", JSON.stringify(tokens));
    else localStorage.removeItem("adsense_tokens");
  }, [tokens]);

  // --- AUTHENTICATION ---

  // 1. One Tap Login (Identity)
  useGoogleOneTapLogin({
    onSuccess: (credentialResponse) => {
      if (credentialResponse.credential) {
        const decoded = jwtDecode<UserProfile>(credentialResponse.credential);
        setUser(decoded);
        message.success(`Welcome back, ${decoded.name}!`);
      }
    },
    onError: () => console.log("One Tap skipped"),
    disabled: !!user,
  });

  // 2. OAuth Flow (Permission for AdSense Data)
  const connectAdSense = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      setLoading(true);
      try {
        const res = await axios.post("/.netlify/functions/fetch-adsense-data", {
          code: codeResponse.code,
        });
        setTokens(res.data.tokens);
        setAccounts(res.data.accounts);
        message.success("AdSense Connected Successfully");
      } catch (error) {
        console.error(error);
        message.error("Failed to connect AdSense");
      } finally {
        setLoading(false);
      }
    },
    flow: "auth-code",
    scope: "https://www.googleapis.com/auth/adsense.readonly",
  });

  const handleLogout = () => {
    googleLogout();
    setUser(null);
    setTokens(null);
    setReportData([]);
    setInsights([]);
    localStorage.clear();
  };

  // --- DATA HANDLING ---

  const handleAccountSelect = async (accountId: string) => {
    setLoading(true);
    setInsights([]); // Reset insights on new selection

    try {
      const res = await axios.post("/.netlify/functions/fetch-adsense-data", {
        tokens: tokens,
        accountId: accountId,
      });

      const rows = res.data.data;
      setReportData(rows || []);

      if (rows && rows.length > 0) {
        // Trigger AI Analysis automatically if data exists
        analyzeData(rows);
      } else {
        message.info("No data found for the last 30 days.");
      }
    } catch (error) {
      console.error(error);
      message.error("Error fetching report.");
    } finally {
      setLoading(false);
    }
  };

  const analyzeData = async (data: any[]) => {
    try {
      // Send top 10 rows to AI to save context window/tokens
      const res = await axios.post("/.netlify/functions/analyze-adsense", {
        adsenseData: data.slice(0, 10),
      });
      setInsights(res.data.insights);
    } catch (error) {
      console.error("AI Error", error);
      message.warning("AI is busy analyzing...");
    }
  };

  // --- TABLE COLUMNS ---
  const columns = [
    {
      title: "Site Domain",
      dataIndex: "site",
      render: (t: string) => <Text strong>{t}</Text>,
    },
    {
      title: "Earnings",
      dataIndex: "earnings",
      sorter: (a: any, b: any) => a.earnings - b.earnings,
      render: (val: number) => (
        <Text type="success" strong>
          ${val.toFixed(2)}
        </Text>
      ),
    },
    {
      title: "Page Views",
      dataIndex: "pageViews",
      render: (val: number) => val.toLocaleString(),
    },
    {
      title: "RPM",
      dataIndex: "rpm",
      render: (val: number) => `$${val.toFixed(2)}`,
    },
    {
      title: "CTR",
      dataIndex: "ctr",
      render: (v: number) => {
        const percentage = (v * 100).toFixed(2);
        let color = "default";
        if (v > 0.05) color = "orange"; // Warning high
        if (v > 0.01 && v <= 0.05) color = "green"; // Good
        return <Tag color={color}>{percentage}%</Tag>;
      },
    },
  ];

  return (
    <ConfigProvider theme={themeConfig}>
      <Layout style={{ minHeight: "100vh", background: "#f8fafc" }}>
        {/* HEADER */}
        <Header
          style={{
            background: "#fff",
            borderBottom: "1px solid #e2e8f0",
            padding: "0 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <DollarCircleOutlined style={{ fontSize: 24, color: "#1677ff" }} />
            <Title level={4} style={{ margin: 0 }}>
              AdSense<span style={{ color: "#1677ff" }}>AI</span>
            </Title>
          </div>
          {user && (
            <Space>
              <Avatar src={user.picture} />
              <Button
                type="text"
                icon={<LogoutOutlined />}
                onClick={handleLogout}
              >
                Sign Out
              </Button>
            </Space>
          )}
        </Header>

        <Content
          style={{
            padding: "32px",
            maxWidth: 1200,
            margin: "0 auto",
            width: "100%",
          }}
        >
          {/* VIEW 1: NOT LOGGED IN */}
          {!user && (
            <div style={{ textAlign: "center", marginTop: 100 }}>
              <Title level={2}>AdSense Intelligence Dashboard</Title>
              <Paragraph type="secondary">
                Sign in to analyze your sites, RPM, and Earnings with AI.
              </Paragraph>
              <Button type="primary" size="large" disabled>
                Use the Google Prompt to Sign In
              </Button>
            </div>
          )}

          {/* VIEW 2: LOGGED IN, NEEDS ADSENSE ACCESS */}
          {user && !tokens && (
            <Card
              style={{
                textAlign: "center",
                maxWidth: 500,
                margin: "40px auto",
                padding: 20,
              }}
            >
              <Title level={3}>Connect Data Source</Title>
              <Paragraph>
                Grant read-only access to your AdSense reports.
              </Paragraph>
              <Button
                type="primary"
                size="large"
                icon={<GoogleOutlined />}
                onClick={() => connectAdSense()}
                loading={loading}
              >
                Connect AdSense Account
              </Button>
            </Card>
          )}

          {/* VIEW 3: MAIN DASHBOARD */}
          {user && tokens && (
            <Space direction="vertical" size="large" style={{ width: "100%" }}>
              {/* Controls Bar */}
              <Card bodyStyle={{ padding: "16px 24px" }}>
                <Row align="middle" justify="space-between" gutter={[16, 16]}>
                  <Col>
                    <Space>
                      <GlobalOutlined style={{ color: "#1677ff" }} />
                      <Text strong>Select Account:</Text>
                      <Select
                        style={{ width: 280 }}
                        placeholder="Choose Publisher ID..."
                        onChange={handleAccountSelect}
                        loading={loading}
                        options={accounts.map((acc) => ({
                          label: acc.displayName,
                          value: acc.name,
                        }))}
                      />
                    </Space>
                  </Col>
                  {reportData.length > 0 && (
                    <Col>
                      <Statistic
                        title="Total 30-Day Earnings"
                        value={reportData.reduce(
                          (acc, curr) => acc + curr.earnings,
                          0
                        )}
                        precision={2}
                        prefix="$"
                        valueStyle={{ color: "#3f8600", fontWeight: "bold" }}
                      />
                    </Col>
                  )}
                </Row>
              </Card>

              {/* Data & AI Area */}
              {reportData.length > 0 && (
                <Row gutter={[24, 24]}>
                  {/* AI Insights Sidebar */}
                  <Col xs={24} lg={8}>
                    <Card
                      title={
                        <Space>
                          <RobotOutlined style={{ color: "#722ed1" }} /> AI
                          Insights
                        </Space>
                      }
                      style={{
                        height: "100%",
                        background: "#f9f0ff",
                        borderColor: "#d3adf7",
                      }}
                    >
                      {insights.length > 0 ? (
                        <Space direction="vertical" style={{ width: "100%" }}>
                          {insights.map((insight, idx) => (
                            <Card
                              key={idx}
                              size="small"
                              type="inner"
                              style={{ borderLeft: "4px solid #722ed1" }}
                            >
                              <Text>{insight}</Text>
                            </Card>
                          ))}
                        </Space>
                      ) : (
                        <div style={{ textAlign: "center", padding: "40px 0" }}>
                          <Spin
                            indicator={
                              <ThunderboltFilled
                                style={{ fontSize: 24, color: "#722ed1" }}
                                spin
                              />
                            }
                          />
                          <div style={{ marginTop: 16, color: "#722ed1" }}>
                            Analyzing RPM trends...
                          </div>
                        </div>
                      )}
                    </Card>
                  </Col>

                  {/* Main Table */}
                  <Col xs={24} lg={16}>
                    <Card
                      title="Site Performance Report"
                      extra={<Tag color="blue">Last 30 Days</Tag>}
                    >
                      <Table
                        dataSource={reportData}
                        columns={columns}
                        rowKey="site"
                        pagination={{ pageSize: 6 }}
                        scroll={{ x: 600 }}
                      />
                    </Card>
                  </Col>
                </Row>
              )}
            </Space>
          )}
        </Content>
      </Layout>
    </ConfigProvider>
  );
};

export default function Root() {
  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID!}>
      <App />
    </GoogleOAuthProvider>
  );
}

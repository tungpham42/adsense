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
  Alert,
  Badge,
} from "antd";
import {
  GoogleOutlined,
  RobotOutlined,
  DollarCircleOutlined,
  ThunderboltFilled,
  GlobalOutlined,
  LogoutOutlined,
  RiseOutlined,
  SafetyCertificateTwoTone,
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
  name: string;
  displayName: string;
}

// --- THEME CONFIGURATION ---
const themeConfig = {
  token: {
    fontFamily: "'Work Sans', sans-serif",
    colorPrimary: "#2b6de3", // Bolder Blue
    colorSuccess: "#10b981", // Modern Green
    colorWarning: "#f59e0b",
    borderRadius: 12,
    fontSize: 15,
    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  },
  components: {
    Button: {
      fontWeight: 600,
      controlHeight: 44,
      borderRadius: 10,
    },
    Card: {
      headerFontSize: 18,
      headerFontWeight: 700,
    },
    Select: {
      controlHeight: 44,
    },
    Table: {
      headerBg: "transparent",
      headerColor: "#666",
      rowHoverBg: "#f0f7ff",
    },
  },
};

const App = () => {
  // --- STATE ---
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem("adsense_user");
    return saved ? JSON.parse(saved) : null;
  });

  const [tokens, setTokens] = useState<any>(() => {
    const saved = localStorage.getItem("adsense_tokens");
    return saved ? JSON.parse(saved) : null;
  });

  const [accounts, setAccounts] = useState<AdSenseAccount[]>(() => {
    const saved = localStorage.getItem("adsense_accounts");
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedAccount, setSelectedAccount] = useState<string | null>(() => {
    return localStorage.getItem("adsense_selected_account");
  });

  const [reportData, setReportData] = useState<any[]>(() => {
    const saved = localStorage.getItem("adsense_report");
    return saved ? JSON.parse(saved) : [];
  });

  const [insights, setInsights] = useState<string[]>(() => {
    const saved = localStorage.getItem("adsense_insights");
    return saved ? JSON.parse(saved) : [];
  });

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

  useEffect(() => {
    if (accounts.length > 0)
      localStorage.setItem("adsense_accounts", JSON.stringify(accounts));
    else localStorage.removeItem("adsense_accounts");
  }, [accounts]);

  useEffect(() => {
    if (selectedAccount)
      localStorage.setItem("adsense_selected_account", selectedAccount);
    else localStorage.removeItem("adsense_selected_account");
  }, [selectedAccount]);

  useEffect(() => {
    if (reportData.length > 0)
      localStorage.setItem("adsense_report", JSON.stringify(reportData));
    else localStorage.removeItem("adsense_report");
  }, [reportData]);

  useEffect(() => {
    if (insights.length > 0)
      localStorage.setItem("adsense_insights", JSON.stringify(insights));
    else localStorage.removeItem("adsense_insights");
  }, [insights]);

  // --- AUTH ---
  useGoogleOneTapLogin({
    onSuccess: (credentialResponse) => {
      if (credentialResponse.credential) {
        const decoded = jwtDecode<UserProfile>(credentialResponse.credential);
        setUser(decoded);
        message.success({
          content: `Welcome back, ${decoded.name}!`,
          icon: <SafetyCertificateTwoTone twoToneColor="#52c41a" />,
        });
      }
    },
    onError: () => console.log("One Tap skipped"),
    disabled: !!user,
  });

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
    setAccounts([]);
    setSelectedAccount(null);
    setReportData([]);
    setInsights([]);
    localStorage.clear();
  };

  const handleAccountSelect = async (accountId: string) => {
    setSelectedAccount(accountId);
    setLoading(true);
    setInsights([]);
    setReportData([]);

    try {
      const res = await axios.post("/.netlify/functions/fetch-adsense-data", {
        tokens: tokens,
        accountId: accountId,
      });

      const rows = res.data.data;
      setReportData(rows || []);

      if (rows && rows.length > 0) {
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
      const res = await axios.post("/.netlify/functions/analyze-adsense", {
        adsenseData: data.slice(0, 10),
      });
      setInsights(res.data.insights);
    } catch (error) {
      console.error("AI Error", error);
      message.warning("AI is busy analyzing...");
    }
  };

  // --- TABLE COLUMNS (UPDATED WITH SORTERS) ---
  const columns = [
    {
      title: "Site Domain",
      dataIndex: "site",
      key: "site",
      render: (t: string) => (
        <Space>
          <Avatar
            src={`https://www.google.com/s2/favicons?domain=${t}&sz=128`}
            shape="square"
            size="small"
          />
          <Text strong style={{ fontSize: 16 }}>
            {t}
          </Text>
        </Space>
      ),
    },
    {
      title: "Earnings",
      dataIndex: "earnings",
      key: "earnings",
      sorter: (a: any, b: any) => a.earnings - b.earnings,
      render: (val: number) => (
        <Text strong style={{ color: "#10b981", fontSize: 16 }}>
          ${val.toFixed(2)}
        </Text>
      ),
    },
    {
      title: "Page Views",
      dataIndex: "pageViews",
      key: "pageViews",
      sorter: (a: any, b: any) => a.pageViews - b.pageViews,
      render: (val: number) => <Text>{val.toLocaleString()}</Text>,
    },
    {
      title: "RPM",
      dataIndex: "rpm",
      key: "rpm",
      sorter: (a: any, b: any) => a.rpm - b.rpm,
      render: (val: number) => <Text type="secondary">${val.toFixed(2)}</Text>,
    },
    {
      title: "CTR",
      dataIndex: "ctr",
      key: "ctr",
      sorter: (a: any, b: any) => a.ctr - b.ctr,
      render: (v: number) => {
        const percentage = (v * 100).toFixed(2);
        let color = "blue";
        if (v > 0.05) color = "warning";
        if (v > 0.01 && v <= 0.05) color = "success";
        return (
          <Tag color={color} style={{ fontWeight: 600, borderRadius: 12 }}>
            {percentage}%
          </Tag>
        );
      },
    },
  ];

  return (
    <ConfigProvider theme={themeConfig}>
      <Layout style={{ minHeight: "100vh", background: "transparent" }}>
        {/* --- HEADER --- */}
        <Header className="glass-header">
          <div
            className="container-max"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              height: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  background: themeConfig.token.colorPrimary,
                  borderRadius: 8,
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <DollarCircleOutlined
                  style={{ fontSize: 20, color: "white" }}
                />
              </div>
              <Title level={4} style={{ margin: 0, letterSpacing: -0.5 }}>
                AdSense
                <span style={{ color: themeConfig.token.colorPrimary }}>
                  AI
                </span>
              </Title>
            </div>
            {user && (
              <Space size="large">
                <Space>
                  <Avatar
                    src={user.picture}
                    style={{
                      border: "2px solid #fff",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    }}
                  />
                  <div style={{ lineHeight: 1.2, display: "none" }}>
                    <Text strong style={{ display: "block" }}>
                      {user.name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Publisher
                    </Text>
                  </div>
                </Space>
                <Button
                  type="text"
                  icon={<LogoutOutlined />}
                  onClick={handleLogout}
                  danger
                />
              </Space>
            )}
          </div>
        </Header>

        <Content style={{ padding: "40px 24px" }} className="container-max">
          {/* --- SCENARIO 1: LOGGED OUT --- */}
          {!user && (
            <div className="hero-container animate-fade-in">
              <div className="hero-card">
                <ThunderboltFilled
                  style={{
                    fontSize: 48,
                    color: themeConfig.token.colorPrimary,
                    marginBottom: 24,
                  }}
                />
                <Title level={1} style={{ marginBottom: 16 }}>
                  Unlock Revenue Insights
                </Title>
                <Paragraph
                  type="secondary"
                  style={{ fontSize: 18, marginBottom: 40 }}
                >
                  Leverage AI to analyze your AdSense performance, detect RPM
                  anomalies, and optimize earnings effortlessly.
                </Paragraph>
                <div style={{ position: "relative" }}>
                  {/* Google One Tap handles the actual button logic usually, but we show visual state */}
                  <Button
                    type="primary"
                    size="large"
                    shape="round"
                    disabled
                    style={{ width: "100%", height: 56, fontSize: 18 }}
                  >
                    Sign in with Google
                  </Button>
                  <Text
                    type="secondary"
                    style={{ display: "block", marginTop: 12, fontSize: 12 }}
                  >
                    Secure access via Google Identity Services
                  </Text>
                </div>
              </div>
            </div>
          )}

          {/* --- SCENARIO 2: CONNECT ADSENSE --- */}
          {user && !tokens && (
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 80,
              }}
              className="animate-fade-in"
            >
              <Card
                className="modern-card"
                style={{
                  maxWidth: 600,
                  width: "100%",
                  textAlign: "center",
                  padding: 40,
                }}
              >
                <Title level={2}>One Last Step</Title>
                <Paragraph style={{ fontSize: 16, marginBottom: 32 }}>
                  We need read-only access to your AdSense reports to generate
                  insights. Your data is processed securely and never stored
                  permanently.
                </Paragraph>
                <Button
                  type="primary"
                  size="large"
                  icon={<GoogleOutlined />}
                  onClick={() => connectAdSense()}
                  loading={loading}
                  style={{ height: 50, padding: "0 40px" }}
                >
                  Connect AdSense Data
                </Button>
              </Card>
            </div>
          )}

          {/* --- SCENARIO 3: DASHBOARD --- */}
          {user && tokens && (
            <Space
              direction="vertical"
              size={32}
              style={{ width: "100%" }}
              className="animate-fade-in"
            >
              {/* Top Controls & KPI */}
              <Row gutter={[24, 24]} align="middle">
                <Col xs={24} md={16}>
                  <Card
                    className="modern-card"
                    bordered={false}
                    bodyStyle={{ padding: 24 }}
                  >
                    <Space
                      direction="vertical"
                      size={4}
                      style={{ width: "100%" }}
                    >
                      <Text
                        type="secondary"
                        strong
                        style={{
                          fontSize: 12,
                          textTransform: "uppercase",
                          letterSpacing: 1,
                        }}
                      >
                        Select Property
                      </Text>
                      <Select
                        size="large"
                        style={{ width: "100%", maxWidth: 400 }}
                        placeholder="Select an AdSense Account..."
                        value={selectedAccount}
                        onChange={handleAccountSelect}
                        loading={loading}
                        suffixIcon={<GlobalOutlined />}
                        options={accounts.map((acc) => ({
                          label: acc.displayName,
                          value: acc.name,
                        }))}
                        variant="borderless"
                        popupMatchSelectWidth={false}
                        dropdownStyle={{ borderRadius: 12, padding: 8 }}
                      />
                    </Space>
                  </Card>
                </Col>
                <Col xs={24} md={8}>
                  {reportData.length > 0 ? (
                    <Card
                      className="modern-card stat-card"
                      bodyStyle={{ padding: 24, width: "100%" }}
                    >
                      <Statistic
                        title={
                          <Text type="secondary">Total 30-Day Earnings</Text>
                        }
                        value={reportData.reduce(
                          (acc, curr) => acc + curr.earnings,
                          0
                        )}
                        precision={2}
                        prefix={
                          <DollarCircleOutlined style={{ color: "#10b981" }} />
                        }
                        valueStyle={{
                          color: "#1f1f1f",
                          fontWeight: 700,
                          fontSize: 32,
                        }}
                      />
                    </Card>
                  ) : (
                    <Alert
                      message="Select an account to view earnings"
                      type="info"
                      showIcon
                      style={{ borderRadius: 12 }}
                    />
                  )}
                </Col>
              </Row>

              {reportData.length > 0 && (
                <Row gutter={[24, 24]}>
                  {/* Left: AI Insights */}
                  <Col xs={24} lg={8}>
                    <Card
                      className="modern-card ai-card"
                      title={
                        <Space>
                          <RobotOutlined
                            style={{ color: "#722ed1", fontSize: 20 }}
                          />
                          <span style={{ color: "#4c1d95" }}>
                            Smart Insights
                          </span>
                        </Space>
                      }
                      extra={
                        insights.length > 0 && (
                          <Badge
                            status="processing"
                            text="Live"
                            color="#722ed1"
                          />
                        )
                      }
                      style={{ height: "100%" }}
                    >
                      {insights.length > 0 ? (
                        <Space
                          direction="vertical"
                          size={16}
                          style={{ width: "100%" }}
                        >
                          {insights.map((insight, idx) => (
                            <div
                              key={idx}
                              style={{
                                background: "white",
                                padding: 16,
                                borderRadius: 16,
                                boxShadow:
                                  "0 4px 12px rgba(114, 46, 209, 0.05)",
                                border: "1px solid rgba(114, 46, 209, 0.1)",
                              }}
                            >
                              <Space align="start">
                                <RiseOutlined
                                  style={{ color: "#722ed1", marginTop: 4 }}
                                />
                                <Text
                                  style={{ fontSize: 14, color: "#4b5563" }}
                                >
                                  {insight}
                                </Text>
                              </Space>
                            </div>
                          ))}
                        </Space>
                      ) : (
                        <div
                          style={{ textAlign: "center", padding: "60px 20px" }}
                        >
                          <Spin
                            size="large"
                            indicator={
                              <ThunderboltFilled
                                style={{ fontSize: 36, color: "#722ed1" }}
                                spin
                              />
                            }
                          />
                          <div
                            style={{
                              marginTop: 24,
                              fontWeight: 600,
                              color: "#722ed1",
                            }}
                          >
                            Analyzing Traffic & RPM...
                          </div>
                          <Text type="secondary">
                            Our AI is crunching the numbers for you.
                          </Text>
                        </div>
                      )}
                    </Card>
                  </Col>

                  {/* Right: Data Table */}
                  <Col xs={24} lg={16}>
                    <Card
                      className="modern-card"
                      title="Performance by Site"
                      extra={
                        <Button type="dashed" shape="round">
                          Last 30 Days
                        </Button>
                      }
                      bodyStyle={{ padding: 0 }}
                    >
                      <Table
                        dataSource={reportData}
                        columns={columns}
                        rowKey="site"
                        scroll={{ x: 600 }}
                        style={{ borderRadius: "0 0 24px 24px" }}
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
